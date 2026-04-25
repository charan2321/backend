# API Documentation Update Rules

Whenever you or the AI assistant make any changes to the backend API endpoints, controllers, routers, or request/response payloads, you MUST automatically update the corresponding API documentation.

## Documentation Guidelines:

1. **Endpoint Details:** Ensure all new or modified endpoints are documented with their correct HTTP method, route path, required authorization (e.g., User/Admin tokens), and required payload structure.

2. **Status Codes (Categorized):**
   - **Approve (200, 201):** Document the success response payload.
   - **Change (400):** Document validation errors.
   - **Discard (401, 403, 404):** Document authorization, permission, and "not found" scenarios.
   - **Error (500):** Mention potential server errors.

3. **Accuracy:** The documentation must perfectly reflect the current state of the code in the `src/` directory.

> **Note:** These rules should always reflect changes directly in `API_DOCUMENTATION.md`.
