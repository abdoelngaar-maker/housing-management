export const ENV = {
  appId: process.env.VITE_APP_ID ?? "housing-management",
  cookieSecret: process.env.JWT_SECRET ?? "",
  databaseUrl: process.env.DATABASE_URL ?? "",
  ownerOpenId: process.env.OWNER_OPEN_ID ?? "",
  isProduction: process.env.NODE_ENV === "production",
  // OpenAI API for LLM (OCR and AI insights)
  openaiApiKey: process.env.OPENAI_API_KEY ?? "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",
  openaiBaseUrl: process.env.OPENAI_BASE_URL ?? "https://api.openai.com/v1",
  openaiModel: process.env.OPENAI_MODEL ?? "gpt-4o-mini",
  // S3-compatible storage (optional - for image uploads)
  s3Endpoint: process.env.S3_ENDPOINT ?? "",
  s3AccessKey: process.env.S3_ACCESS_KEY ?? "",
  s3SecretKey: process.env.S3_SECRET_KEY ?? "",
  s3Bucket: process.env.S3_BUCKET ?? "",
  s3Region: process.env.S3_REGION ?? "auto",
};
