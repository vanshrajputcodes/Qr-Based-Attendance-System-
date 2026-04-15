# Attendu — QR-Based Smart Attendance System

Attendu is a secure, real-time QR-based attendance system designed for classrooms. It ensures that attendance is recorded only when students are physically present within a defined geofence and time window.

---

## System Architecture

```mermaid
flowchart LR
    A[Frontend (React + TypeScript)] --> B[Backend (Supabase)]
    B --> C[PostgreSQL Database]
    B --> D[Auth System]
    B --> E[Realtime Engine]
    B --> F[Edge Functions]

    F --> G[HMAC Token Generation]
    F --> H[Attendance Verification]
    F --> I[Geofence Validation]

    A --> |QR Scan + Location + Device Hash| B
```

---

## Technology Stack

### Frontend
- React with TypeScript
- Vite
- Tailwind CSS
- html5-qrcode
- Geolocation API
- Device fingerprinting

### Backend
- Supabase (PostgreSQL, Auth, Realtime)
- Row Level Security (RLS)
- REST APIs / Edge Functions

### Edge Layer
- HMAC-based token generation
- Attendance verification
- Geofence validation (Haversine)

---

## Database Architecture

```mermaid
erDiagram
    profiles {
        UUID id
        string name
        string institution
    }

    user_roles {
        UUID user_id
        string role
    }

    rooms {
        UUID id
        UUID teacher_id
        string name
        float latitude
        float longitude
        float radius
    }

    subjects {
        UUID id
        UUID room_id
        string subject_name
    }

    sessions {
        UUID id
        UUID room_id
        UUID subject_id
        UUID teacher_id
        string status
        timestamp start_time
        timestamp end_time
        string secret_key
    }

    attendance {
        UUID id
        UUID session_id
        UUID student_id
        timestamp timestamp
        float latitude
        float longitude
        string device_hash
        string status
    }

    profiles ||--o{ user_roles : has
    profiles ||--o{ attendance : marks
    rooms ||--o{ subjects : contains
    rooms ||--o{ sessions : hosts
    sessions ||--o{ attendance : records
```

---

## Teacher Workflow

```mermaid
flowchart TD
    A[Login] --> B[Create Room]
    B --> C[Add Subject]
    C --> D[Start Session]
    D --> E[Generate Secret Key]
    E --> F[Display QR Code]
    F --> G[Monitor Live Attendance]
    G --> H[End Session]
```

---

## Student Workflow

```mermaid
flowchart TD
    A[Login] --> B[Open Dashboard]
    B --> C[Scan QR Code]
    C --> D[Capture Location]
    D --> E[Generate Device Hash]
    E --> F[Send Request]
    F --> G[Receive Confirmation]
```

---

## QR Token System

- Refresh interval: 20 seconds
- Signed using HMAC

```mermaid
flowchart LR
    A[Session ID] --> D[Token]
    B[Expiry Time] --> D
    C[Secret Key] --> E[HMAC Signature]
    E --> D
```

---

## Attendance Verification Flow

```mermaid
flowchart TD
    A[Request Received] --> B[Validate Token]
    B --> C[Check Expiry]
    C --> D[Check Session Active]
    D --> E[Geofence Validation]
    E --> F[Duplicate Check]
    F --> G[Mark Attendance]
```

---

## System Workflow

```mermaid
sequenceDiagram
    participant T as Teacher
    participant S as Student
    participant B as Backend

    T->>B: Start Session
    B->>T: Generate QR

    S->>T: Scan QR
    S->>B: Send token + location + device hash

    B->>B: Validate token
    B->>B: Check geofence
    B->>B: Prevent duplicate

    B->>S: Attendance Confirmed
    B->>T: Update Dashboard
```

---

## Security Highlights

- Short-lived QR tokens
- HMAC-based signatures
- Server-side validation
- Geofence enforcement
- Device fingerprint tracking
- Row Level Security (RLS)
- Role-based access control

---

## Key Advantages

- Prevents proxy attendance
- Location-restricted validation
- Time-bound QR tokens
- Real-time updates
- Scalable architecture

---

## License

MIT License
