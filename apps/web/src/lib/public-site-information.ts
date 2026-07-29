export interface PublicSiteInformation {
  operatorName: string;
  serviceAddress: [string, string, string];
  contactEmail: string;
  vatId: string | null;
  register: string | null;
  supervisoryAuthority: string | null;
  dataProtectionAuthority: {
    name: string;
    address: [string, string, string];
    email: string;
    website: string;
  };
  dataRetention: string;
  lastUpdated: string;
}
