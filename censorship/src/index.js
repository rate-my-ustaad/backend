/**
 * Welcome to Cloudflare Workers! This is your first worker.
 *
 * - Run `npm run dev` in your terminal to start a development server
 * - Open a browser tab at http://localhost:8787/ to see your worker in action
 * - Run `npm run deploy` to publish your worker
 *
 * Learn more at https://developers.cloudflare.com/workers/
 */

import { jwtVerify, createRemoteJWKSet } from 'jose';

const FIREBASE_PROJECT_ID = 'rate-my-ustaad'; // TODO: set your Firebase project ID
const FIREBASE_ISSUER = `https://securetoken.google.com/${FIREBASE_PROJECT_ID}`;
const FIREBASE_JWKS_URL = 'https://www.googleapis.com/robot/v1/metadata/x509/securetoken@system.gserviceaccount.com';

// CORS headers for all responses
const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
  'Access-Control-Max-Age': '86400',
};

// Helper function to handle CORS preflight requests
function handleOptions(request) {
  return new Response(null, {
    headers: corsHeaders,
    status: 204,
  });
}

async function verifyFirebaseToken(authHeader, env) {
	if (!authHeader || !authHeader.startsWith('Bearer ')) {
		throw new Error('Missing or invalid Authorization header');
	}
	const token = authHeader.substring(7);
	const JWKS = createRemoteJWKSet(new URL('https://www.googleapis.com/service_accounts/v1/jwk/securetoken@system.gserviceaccount.com'));
	try {
		const { payload } = await jwtVerify(token, JWKS, {
			issuer: FIREBASE_ISSUER,
			audience: FIREBASE_PROJECT_ID,
		});
		return payload;
	} catch (e) {
		throw new Error('Invalid Firebase JWT: ' + e.message);
	}
}

export default {
	async fetch(request, env) {
		// Handle CORS preflight requests
		if (request.method === 'OPTIONS') {
			return handleOptions(request);
		}

		// Firebase JWT validation
		// const authHeader = request.headers.get('Authorization');
		// try {
		// 	console.log('Authorization header:', authHeader);
		// 	await verifyFirebaseToken(authHeader, env);
		// } catch (e) {
		// 	return new Response(JSON.stringify({ error: e.message, accepted: false }), {
		// 		status: 401,
		// 		headers: { 'Content-Type': 'application/json', ...corsHeaders }
		// 	});
		// }

		// Only process POST requests
		if (request.method !== 'POST') {
			return new Response(JSON.stringify({ error: "Method not allowed. Please use POST." }), {
				status: 405,
				headers: { 'Content-Type': 'application/json', ...corsHeaders }
			});
		}

		try {
			// Parse the request body to get the review
			const { review } = await request.json();

			if (!review) {
				return new Response(JSON.stringify({
					error: "Missing review content",
					accepted: false
				}), {
					status: 400,
					headers: { 'Content-Type': 'application/json', ...corsHeaders }
				});
			}

			// Use AI to determine if the review meets the criteria
			const prompt = `
You are a content moderator for a "Rate My Professor" website. 
Analyze the following student review of a teacher and determine if it should be accepted or rejected.

Review: "${review}"

Criteria for accepting the review:
1. It should NOT contain any curse words or inappropriate language
2. It should be a specific feedback or review about the teacher, not a generic statement
3. It should be relevant to a professor/teacher review context

Respond with a JSON object that includes:
- "accepted": true or false
- "reason": brief explanation of your decision
`;

			const response = await env.AI.run("@cf/meta/llama-3.1-8b-instruct", {
				prompt: prompt,
			});

			// Parse the AI response
			let result;
			try {
				// Check if response is already an object (not a string)
				if (typeof response === 'object' && response !== null) {
					// If it has a 'response' property (which might contain markdown code blocks)
					if (response.response) {
						// Try to extract JSON from markdown code blocks
						const codeBlockMatch = String(response.response).match(/```(?:json)?\s*(\{[\s\S]*?\})\s*```/);
						if (codeBlockMatch && codeBlockMatch[1]) {
							try {
								result = JSON.parse(codeBlockMatch[1]);
							} catch (e) {
								// If parsing the code block fails, use the original response object
								result = response;
							}
						} else {
							// No code blocks found, use the original response
							result = response;
						}
					} else {
						// No response property, use the entire object
						result = response;
					}
				} else {
					// Try to parse the JSON directly from the response if it's a string
					result = JSON.parse(response);
				}
			} catch (e) {
				// If direct parsing fails, try to extract JSON from the text response
				const responseStr = String(response);

				// Try to extract JSON from markdown code blocks first
				const codeBlockMatch = responseStr.match(/```(?:json)?\s*(\{[\s\S]*?\})\s*```/);
				if (codeBlockMatch && codeBlockMatch[1]) {
					try {
						result = JSON.parse(codeBlockMatch[1]);
					} catch (e2) {
						// If that fails, try the regular JSON extraction
						const jsonMatch = responseStr.match(/\{[\s\S]*\}/);
						if (jsonMatch) {
							try {
								result = JSON.parse(jsonMatch[0]);
							} catch (e3) {
								// If extraction fails, create a formatted response
								result = {
									accepted: responseStr.toLowerCase().includes("true"),
									reason: "AI evaluation completed, but response formatting was unclear."
								};
							}
						} else {
							// Fallback to a basic determination
							result = {
								accepted: responseStr.toLowerCase().includes("accept") && !responseStr.toLowerCase().includes("reject"),
								reason: "Based on AI evaluation (unformatted response)"
							};
						}
					}
				} else {
					// No code blocks, try regular JSON extraction
					const jsonMatch = responseStr.match(/\{[\s\S]*\}/);
					if (jsonMatch) {
						try {
							result = JSON.parse(jsonMatch[0]);
						} catch (e2) {
							// If extraction fails, create a formatted response
							result = {
								accepted: responseStr.toLowerCase().includes("true"),
								reason: "AI evaluation completed, but response formatting was unclear."
							};
						}
					} else {
						// Fallback to a basic determination
						result = {
							accepted: responseStr.toLowerCase().includes("accept") && !responseStr.toLowerCase().includes("reject"),
							reason: "Based on AI evaluation (unformatted response)"
						};
					}
				}
			}

			// Ensure the result has the right structure
			if (!result.hasOwnProperty('accepted')) {
				result = {
					accepted: false,
					reason: "Could not determine acceptance status from AI response",
					originalResponse: result
				};
			}

			return new Response(JSON.stringify(result), {
				headers: { 'Content-Type': 'application/json', ...corsHeaders }
			});

		} catch (error) {
			return new Response(JSON.stringify({
				error: "Error processing review",
				message: error.message,
				accepted: false
			}), {
				status: 500,
				headers: { 'Content-Type': 'application/json', ...corsHeaders }
			});
		}
	},
};