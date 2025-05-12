import { env, createExecutionContext, waitOnExecutionContext, SELF } from 'cloudflare:test';
import { describe, it, expect } from 'vitest';
import worker from '../src';

const VALID_TOKEN = 'eyJhbGciOiJSUzI1NiIsImtpZCI6IjU5MWYxNWRlZTg0OTUzNjZjOTgyZTA1MTMzYmNhOGYyNDg5ZWFjNzIiLCJ0eXAiOiJKV1QifQ.eyJuYW1lIjoiTXVoYW1tYWQgSGFkaSBLaGFuIiwicGljdHVyZSI6Imh0dHBzOi8vbGgzLmdvb2dsZXVzZXJjb250ZW50LmNvbS9hL0FDZzhvY0lNdDY1TnhtZUdrUjlRaWx0MWNEdGJtR1UzTUpxV2VfaXlVMll0TnpfaEVXMWZiZz1zOTYtYyIsImlzcyI6Imh0dHBzOi8vc2VjdXJldG9rZW4uZ29vZ2xlLmNvbS9yYXRlLW15LXVzdGFhZCIsImF1ZCI6InJhdGUtbXktdXN0YWFkIiwiYXV0aF90aW1lIjoxNzQ3MDgyMjY5LCJ1c2VyX2lkIjoiYVc3anRsOFMwTGUwMzdPOUtHSHBFekJJZkxFMyIsInN1YiI6ImFXN2p0bDhTMExlMDM3TzlLR0hwRXpCSWZMRTMiLCJpYXQiOjE3NDcwODIyNjksImV4cCI6MTc0NzA4NTg2OSwiZW1haWwiOiJtaGtoYW4uYnNjczIyc2VlY3NAc2VlY3MuZWR1LnBrIiwiZW1haWxfdmVyaWZpZWQiOnRydWUsImZpcmViYXNlIjp7ImlkZW50aXRpZXMiOnsiZ29vZ2xlLmNvbSI6WyIxMDU4Mjk5OTIyNTIwMTE1ODcwMDIiXSwiZW1haWwiOlsibWhraGFuLmJzY3MyMnNlZWNzQHNlZWNzLmVkdS5wayJdfSwic2lnbl9pbl9wcm92aWRlciI6Imdvb2dsZS5jb20ifX0.eiTMbxwKWJwqFPpy-dLgZ9T4fur4gf7sfhlHEgPM23d-k1MQ3sDOUe8Ny6a1m_uc3KPLnWd3MCEugrwRFKAd0QYCIZLWcTEtOcCF39s7RIpKwHXl-ospBsfA_RXAEVzIvi7WX6eh7nN1TPDQ3yqc6vQlfesMjbD5JJMOcLwn1ZawZySmOJ_ZIf3K_vpgLdnwIvM4nUa8UazfmvzqZw7O_xRKXOiSiOs3pH1WA9VmN2y5GlG6DWQvbYJZtzt2VpTDd4ZEVl_ujobK_VZR5-qjn31HQjEZgFTldrPnDl83G_gf2agZnFY1USnI0K2mtsovrA_p9EsalKG3JEc2FCngWA'; // Replace with a real valid token for your Firebase project
const INVALID_TOKEN = 'invalid.jwt.token';

async function makeRequest(token, review = 'Great teacher! Very helpful and clear.') {
	return await fetch('http://localhost:8787', {
		method: 'POST',
		headers: {
			'Authorization': `Bearer ${token}`,
			'Content-Type': 'application/json',
		},
		body: JSON.stringify({ review }),
	});
}

describe('Cloudflare Worker Firebase JWT validation', () => {
	it('should reject request with missing token', async () => {
		const res = await fetch('http://localhost:8787', {
			method: 'POST',
			body: JSON.stringify({ review: 'Test review' }),
			headers: { 'Content-Type': 'application/json' },
		});
		const data = await res.json();
		expect(res.status).toBe(401);
		expect(data.error).toMatch(/Authorization/);
	});

	it('should reject request with invalid token', async () => {
		const res = await makeRequest(INVALID_TOKEN);
		const data = await res.json();
		expect(res.status).toBe(401);
		expect(data.error).toMatch(/Invalid Firebase JWT/);
	});

	it('should accept request with valid token', async () => {
		if (VALID_TOKEN === 'YOUR_VALID_FIREBASE_JWT') {
			console.warn('Please set a real Firebase JWT in VALID_TOKEN to run this test.');
			return;
		}
		const res = await makeRequest(VALID_TOKEN);
		const data = await res.json();
		expect(res.status).toBe(200);
		expect(data).toHaveProperty('accepted');
	});
});
