import { loadPublicSiteInformation } from "../apps/server/src/public-site-information.ts";

const information = await loadPublicSiteInformation();
console.log(
  `Öffentliche Betreiberangaben geprüft für ${information.operatorName} (${information.lastUpdated}).`,
);
