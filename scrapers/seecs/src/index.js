/**
 * SEECS Faculty Scraper
 *
 * - Scrapes faculty names from SEECS NUST website
 * - Stores faculty data in Firestore
 * - Run `npm run dev` in your terminal to start a development server
 * - Run `npm run deploy` to publish your worker
 */

import { Database } from 'firebase-firestore-lite';

export default {
	async fetch(request, env, ctx) {
		try {
			// Add browser-like headers to prevent 403 Forbidden errors
			const headers = {
				'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36',
				'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
				'Accept-Language': 'en-US,en;q=0.5',
				'Referer': 'https://seecs.nust.edu.pk/',
				'DNT': '1',
				'Connection': 'keep-alive',
				'Upgrade-Insecure-Requests': '1'
			};

			// Fetch the faculty page with browser-like headers
			const response = await fetch('https://seecs.nust.edu.pk/faculty/', {
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

			// Parse faculty names
			const facultyData = [];
			const seenNames = new Set(); // Track seen names to avoid duplicates
			const facultyCardRegex = /<div class="card faculty-card">([\s\S]*?)<\/div>\s*<\/div>/g;

			let cardMatch;
			while ((cardMatch = facultyCardRegex.exec(html)) !== null) {
				const cardContent = cardMatch[1];

				// Extract name
				const nameMatch = cardContent.match(/<div class="name">\s*<h4>(.*?)<\/h4>\s*<\/div>/);
				const name = nameMatch ? nameMatch[1].trim() : null;

				// Create faculty object with proper capital case name (only if not already seen)
				if (name && !seenNames.has(name)) {
					// Add name to seen set
					seenNames.add(name);

					// Convert name to capital case (first letter of each word capitalized)
					const capitalizedName = name.split(' ')
						.map(word => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
						.join(' ');

					facultyData.push({
						name: capitalizedName,
						department: "SEECS",
						institution: "NUST"
					});
				}
			}

			// Count faculty members
			const count = facultyData.length;

			// Initialize Firestore Database with project ID
			const db = new Database({
				projectId: "rate-my-ustaad",
				// Optional auth configuration if needed
				// auth: {
				// 	apiKey: env.FIREBASE_API_KEY
				// }
			});

			// Get a reference to the faculty collection
			const facultyCollection = db.ref('faculty');

			// Create a transaction for batch operations
			const tx = db.transaction();
			let firestoreResults = [];

			for (const faculty of facultyData) {
				// Create a document ID from the faculty name (converted to lowercase and spaces replaced with hyphens)
				const docId = faculty.name.toLowerCase().replace(/\s+/g, '-');

				// Add document to transaction
				tx.set(`faculty/${docId}`, {
					...faculty,
					updatedAt: new Date().toISOString()
				});

				firestoreResults.push({
					id: docId,
					...faculty
				});
			}

			// Commit the transaction
			try {
				await tx.commit();
				console.log(`Successfully stored ${count} faculty members in Firestore`);
			} catch (firestoreError) {
				console.error('Firestore error:', firestoreError);
				// Continue execution to return scraped data even if Firestore update fails
			}

			// Create result object
			const result = {
				totalFaculty: count,
				faculty: firestoreResults.length > 0 ? firestoreResults : facultyData,
				storedInFirestore: firestoreResults.length > 0,
				scrapedAt: new Date().toISOString()
			};

			// Log the results (would be visible in the worker logs)
			console.log('Scraped faculty data:', result);

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
