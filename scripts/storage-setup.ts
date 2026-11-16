/** Creates the local MinIO bucket, CORS rules and public-read policy on media/. */
import { ensureLocalBucket } from "../src/server/lib/storage";

ensureLocalBucket()
  .then(() => console.log("✓ Local media bucket ready"))
  .catch((err) => {
    console.error("Failed to set up local bucket:", err);
    process.exit(1);
  });
