# LinguaStar Backend

Express + MongoDB backend for LinguaStar with JWT auth, Razorpay payment handling, and admin controls.

## Setup

1. Copy `.env.example` to `.env` and fill values.
2. Install dependencies:
   - `npm install`
3. Start development server:
   - `npm run dev`

## Scripts

- `npm run dev` - start in watch mode
- `npm run typecheck` - run TypeScript checks
- `npm run build` - compile to `dist`
- `npm start` - run built server

## API Base

- Versioned prefix: `/api/v1`
- Health checks: `/health`, `/ready`

## Response Contract

Success:

```json
{ "success": true, "data": {} }
```

Failure:

```json
{
  "success": false,
  "error": {
    "code": "ERROR_CODE",
    "message": "Human readable message",
    "fields": {}
  }
}
```

## Postman

- Collection: `backend/postman/collection.json`
- Environment: `backend/postman/environment.json`
