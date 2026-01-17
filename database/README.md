# YoPago Database

PostgreSQL database for YoPago shared expense tracking.

## Schema

### Tables

#### expense_groups
- `id` - Primary key
- `name` - Group name
- `description` - Group description
- `created_by` - Username of group creator
- `created_at` - Timestamp of creation

#### expenses
- `id` - Primary key
- `description` - Expense description
- `amount` - Expense amount (decimal)
- `paid_by` - Username of person who paid
- `group_id` - Foreign key to expense_groups
- `category` - Expense category
- `created_at` - Timestamp of creation
- `updated_at` - Timestamp of last update

## Running Locally

### Using Docker Compose

```bash
docker-compose up postgres
```

### Using PostgreSQL directly

```bash
createdb yopago
psql yopago < database/init/01-init.sql
```

## Connection Details

Default local connection:
- Host: localhost
- Port: 5432
- Database: yopago
- Username: yopago
- Password: yopago123

## Migrations

Database migrations are handled by Flyway in the Spring Boot application.
Migration files are located in `backend/src/main/resources/db/migration/`.

## Sample Data

The initialization script includes sample data for development:
- 2 expense groups
- 4 sample expenses
- All owned by the 'demo' user

## Backup and Restore

### Backup
```bash
pg_dump -h localhost -U yopago yopago > backup.sql
```

### Restore
```bash
psql -h localhost -U yopago yopago < backup.sql
```
