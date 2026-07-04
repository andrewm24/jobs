// Local apply-assist runner for when you're not using the Dockerized noVNC browser:
//   npm run apply -w server -- <jobId>
import { runApplyAssist } from "./applyAssist.js";

const jobId = process.argv[2];
if (!jobId) {
  console.error("Usage: npm run apply -w server -- <jobId>");
  process.exit(1);
}

runApplyAssist(jobId)
  .then(() => console.log("Apply-assist finished. Review and submit in the browser window, then close it."))
  .catch((err) => {
    console.error(err);
    process.exit(1);
  });
