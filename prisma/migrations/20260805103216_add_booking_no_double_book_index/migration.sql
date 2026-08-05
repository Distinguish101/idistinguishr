-- Partial unique index: prevents two non-cancelled bookings from ever
-- occupying the same teacher/date/time, even under a race condition.
-- Prisma's schema DSL can't express a partial index, so this is raw SQL —
-- see the comment on the Booking model in schema.prisma.
CREATE UNIQUE INDEX booking_no_double_book
ON bookings ("teacherId", "lessonDate", "startTime")
WHERE status != 'CANCELLED';
