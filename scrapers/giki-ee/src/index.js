/**
 * GIKI EE Faculty Scraper
 *
 * - Scrapes faculty names from GIKI EE website
 * - Stores faculty data in Firestore
 * - Run `npm run dev` in your terminal to start a development server
 * - Run `npm run deploy` to publish your worker
 */

import { Database } from 'firebase-firestore-lite';

/**
 * Retrieves all documents from a Firestore collection, handling pagination automatically
 * @param {Object} collectionRef - Reference to the Firestore collection
 * @returns {Promise<Array>} - All documents from the collection
 */
async function getAllDocuments(collectionRef) {
	let allDocuments = [];
	let pageToken = undefined;
	const pageSize = 100; // Fetch 100 documents per request

	// Loop until we've retrieved all documents
	do {
		// Get a page of documents
		const result = await collectionRef.list({
			pageSize,
			pageToken
		});

		// Add the documents to our array
		allDocuments = allDocuments.concat(result.documents);

		// Get the next page token
		pageToken = result.options.pageToken;

		console.log(`Retrieved ${result.documents.length} documents, total so far: ${allDocuments.length}`);
	} while (pageToken); // Continue until there are no more pages

	return allDocuments;
}

export default {
	async fetch(request, env, ctx) {
		try {
			// Add browser-like headers to prevent 403 Forbidden errors
			const headers = {
				'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36',
				'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
				'Accept-Language': 'en-US,en;q=0.5',
				'Referer': 'https://giki.edu.pk/fee/',
				'DNT': '1',
				'Connection': 'keep-alive',
				'Upgrade-Insecure-Requests': '1'
			};

			// Use HTTP instead of HTTPS to bypass certificate validation issues completely
			const url = 'http://giki.edu.pk/fee/fee-faculty-profile/';
			console.log(`Fetching GIKI faculty data from ${url}`);

			const response = await fetch(url, {
				headers,
				cf: {
					cacheTtl: 0,
					cacheEverything: false
				}
			});

			if (!response.ok) {
				throw new Error(`Failed to fetch: ${response.status} ${response.statusText}`);
			}

			// Get the HTML content
			const html = await response.text();

			// Parse faculty names with the new HTML structure
			const facultyData = [];
			const seenNames = new Set(); // Track seen names to avoid duplicates

			// Updated regex to match the faculty name in the title tag
			const facultyNameRegex = /<h3 class="gdlr-core-personnel-list-title"\s*><a href="[^"]*"\s*>([^<]+)<\/a><\/h3>/g;

			let nameMatch;
			while ((nameMatch = facultyNameRegex.exec(html)) !== null) {
				const rawName = nameMatch[1].trim();

				// Improve name cleaning to more aggressively remove titles
				// First pass - remove titles globally (not just at the beginning)
				let cleanName = rawName
					.replace(/(Prof\.|Dr\.|Engr\.|Professor|Doctor|Engineer)\.?\s*/gi, '') // Remove titles anywhere in the name
					.replace(/,?\s+(Member\s+IEEE|IEEE|Ph\.?D\.?|M\.?S\.?|B\.?S\.?).*$/i, '') // Remove suffixes
					.replace(/\s+/g, ' ') // Replace multiple spaces with a single space
					.trim(); // Remove leading and trailing spaces

				// Create faculty object with proper capital case name (only if not already seen)
				if (cleanName && !seenNames.has(cleanName)) {
					// Add name to seen set
					seenNames.add(cleanName);

					// Convert name to capital case (first letter of each word capitalized)
					const capitalizedName = cleanName.split(' ')
						.map(word => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
						.join(' ');

					facultyData.push({
						name: capitalizedName,
						department: "EE",
						institution: "GIKI",
						updatedAt: new Date().toISOString()
					});

					console.log(`Found faculty member: ${capitalizedName} (original: ${rawName})`);
				}
			}

			// Count faculty members
			const count = facultyData.length;

			// Initialize Firestore Database with project ID
			const db = new Database({
				projectId: "rate-my-ustaad",
			});

			// Get a reference to the faculty collection
			const facultyCollection = db.ref('teachers');

			// Get all existing faculty documents
			console.log("Fetching all existing faculty documents...");
			const existingFaculty = await getAllDocuments(facultyCollection);
			console.log(`Retrieved ${existingFaculty.length} total faculty documents`);

			// Create a map of existing faculty by name for quick lookups
			const existingFacultyMap = {};
			for (const doc of existingFaculty) {
				// Use document ID as the key
				const docId = doc.__meta__.id;
				existingFacultyMap[docId] = doc;
			}

			// Create a transaction for batch operations
			const tx = db.transaction();
			let firestoreResults = [];
			let skippedDocuments = [];

			// Process faculty data in batch
			for (const faculty of facultyData) {
				// Create a document ID from the faculty name, institution, and department
				// Format: name_institution_department (all lowercase with spaces replaced by underscores)
				const docId = `${faculty.name.toLowerCase().replace(/\s+/g, '_')}_${faculty.institution.toLowerCase()}_${faculty.department.toLowerCase()}`;

				// Check if document already exists in our map
				if (existingFacultyMap[docId]) {
					console.log(`Skipping existing document: ${docId}`);
					skippedDocuments.push({
						id: docId,
						...faculty
					});
					continue;
				}
				// Document doesn't exist, add it to the transaction
				try {
					tx.set(`teachers/${docId}`, faculty);

					firestoreResults.push({
						id: docId,
						...faculty
					});
				} catch (docError) {
					console.error(`Error processing document ${docId}:`, docError);
					skippedDocuments.push({
						id: docId,
						...faculty,
						error: docError.message
					});
				}
			}

			// Commit the transaction
			try {
				if (firestoreResults.length > 0) {
					await tx.commit();
					console.log(`Successfully stored ${firestoreResults.length} faculty members in Firestore`);
				} else {
					console.log('No new faculty members to store in Firestore');
				}
			} catch (firestoreError) {
				console.error('Firestore error:', firestoreError);
				firestoreResults = []; // If the transaction failed, no documents were written
			}

			// Create result object
			const result = {
				totalFaculty: count,
				addedFaculty: firestoreResults,
				skippedExisting: skippedDocuments,
				existingFacultyCount: existingFaculty.length,
				storedInFirestore: firestoreResults.length > 0,
				scrapedAt: new Date().toISOString()
			};

			// Return the results as JSON
			return new Response(JSON.stringify(result, null, 2), {
				headers: {
					'Content-Type': 'application/json',
				},
			});
		} catch (error) {
			console.error('Scraper error:', error);
			return new Response(JSON.stringify({ error: error.message }), {
				status: 500,
				headers: {
					'Content-Type': 'application/json',
				},
			});
		}
	},
};
