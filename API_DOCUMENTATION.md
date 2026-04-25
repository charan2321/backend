# LinguaStar API Documentation

## Auth

### POST /api/v1/auth/register
- Auth required: No
- Body: `{ name, email, password }`
- 201: returns user id/email
- 409: email conflict

### POST /api/v1/auth/login
- Auth required: No
- Body: `{ email, password }`
- 200: returns access token + sets refresh cookie
- 401: invalid credentials
- 429: account locked after failed attempts

### POST /api/v1/auth/refresh
- Auth required: Refresh cookie
- 200: rotates refresh token + returns access token
- 401: invalid/expired/reused refresh token

### POST /api/v1/auth/logout
- Auth required: Yes
- 200: clears refresh cookie and revokes DB token hash

### POST /api/v1/auth/otp/send
- Auth required: No
- Body: `{ "email": "user@example.com" }`
- 200: Generates and sends a 6-digit OTP. (In development, the OTP is printed to the terminal console).
- 400: Validation error (invalid email format)
- 404: User not found

### POST /api/v1/auth/otp/verify
- Auth required: No
- Body: `{ "email": "user@example.com", "otp": "123456" }`
- 200: OTP verified successfully. Returns `accessToken` + sets refresh cookie (just like normal login).
- 401: Invalid/Expired OTP or missing request

## Users

### GET /api/v1/users/me
- Auth required: Yes
- 200: profile + subscription data

### PATCH /api/v1/users/me
- Auth required: Yes
- Body: `{ name? , password? }`
- 200: updated profile
- 400: validation error

### GET /api/v1/users/me/activity
- Auth required: Yes
- 200: daily activity list

## Books

### GET /api/v1/books
- Auth required: No
- 200: published metadata list only

### GET /api/v1/books/:id
- Auth required: Yes
- 200: metadata when user has book/subscription access
- 403: not purchased/subscribed

### GET /api/v1/books/:id/read
- Auth required: Yes
- 200: protected content stream key placeholder
- 403: not purchased/subscribed

## Payments

### POST /api/v1/payments/create-order
- Auth required: Yes
- Body: `{ type: individual_book | subscription_30 | subscription_60, bookId? }`
- 201: Razorpay order id + amount in paise

### POST /api/v1/payments/verify
- Auth required: Yes
- Body: `{ razorpayOrderId, razorpayPaymentId, razorpaySignature }`
- 200: verifies signature and unlocks book/subscription

### POST /api/v1/payments/webhook
- Auth required: Razorpay HMAC signature header
- 200: webhook receipt acknowledgment
- 401: invalid signature

## Admin (role: admin)

### GET /api/v1/admin/users
- Lists users (sensitive hashes excluded)

### GET /api/v1/admin/books
- Lists all books

### POST /api/v1/admin/books
- Creates new book

### PATCH /api/v1/admin/books/:id
- Updates metadata and publish state

### DELETE /api/v1/admin/books/:id
- Soft unpublish (`isPublished = false`)

### GET /api/v1/admin/payments
- Lists all payment records

## Error Codes

- `VALIDATION_ERROR`, `UNAUTHORIZED`, `TOKEN_INVALID`, `REFRESH_TOKEN_INVALID`
- `FORBIDDEN`, `NOT_FOUND`, `CONFLICT`, `INVALID_REQUEST`, `INTERNAL_ERROR`
