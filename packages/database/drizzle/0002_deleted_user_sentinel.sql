INSERT INTO "user" (
  "id",
  "name",
  "email",
  "email_verified",
  "image",
  "created_at",
  "updated_at"
)
VALUES (
  '00000000-0000-0000-0000-000000000000',
  'Изтрит играч',
  'deleted@local.invalid',
  true,
  null,
  NOW(),
  NOW()
)
ON CONFLICT ("id") DO NOTHING;
