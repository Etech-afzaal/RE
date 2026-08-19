import {
  getApprovedAgents,
  getAgentDiscoveryAreas,
  getAgentDiscoveryCities,
} from "@/lib/queries";
import CustomerHome from "@/components/CustomerHome";

export const revalidate = 60;

export const metadata = {
  title: "Dhalahore Properties — Find Trusted Real Estate Agents in Lahore",
  description:
    "Discover verified DHA Lahore and Lahore estate agents. Browse profiles, areas served, and connect directly.",
};

export default async function HomePage() {
  const [agents, areas, cities] = await Promise.all([
    getApprovedAgents(),
    getAgentDiscoveryAreas(),
    getAgentDiscoveryCities(),
  ]);

  return (
    <>
      <a
        href="https://wa.me/923092670648"
        aria-label="Chat with us on WhatsApp"
        target="_blank"
        rel="noopener noreferrer"
        style={{
          position: "fixed",
          left: "24px",
          bottom: "24px",
          zIndex: 9999,
          display: "inline-flex",
          alignItems: "center",
          justifyContent: "center",
          width: "58px",
          height: "58px",
          borderRadius: "999px",
          background: "#25d366",
          color: "#fff",
          boxShadow: "0 14px 30px rgba(37, 211, 102, 0.32)",
        }}
      >
        <svg
          viewBox="0 0 24 24"
          fill="currentColor"
          aria-hidden="true"
          style={{ width: "28px", height: "28px" }}
        >
          <path d="M20.52 3.48A11.7 11.7 0 0 0 12.06 0C5.46 0 .1 5.34.1 11.94c0 2.1.55 4.15 1.6 5.96L0 24l6.32-1.66a11.9 11.9 0 0 0 5.74 1.47h.01c6.6 0 11.96-5.35 11.96-11.95 0-3.2-1.24-6.2-3.51-8.48ZM12.06 21.8c-1.84 0-3.65-.5-5.23-1.43l-.38-.22-3.75.98 1-3.64-.24-.38A9.84 9.84 0 0 1 2.12 11.94c0-5.44 4.42-9.86 9.94-9.86a9.8 9.8 0 0 1 6.95 2.88 9.84 9.84 0 0 1 2.88 6.98c0 5.44-4.42 9.86-9.83 9.86Zm5.4-7.4c-.3-.15-1.77-.87-2.04-.97-.27-.1-.47-.15-.66.15-.2.3-.76.97-.94 1.17-.17.2-.35.22-.65.08-.3-.15-1.24-.46-2.36-1.46-.87-.78-1.46-1.74-1.63-2.04-.17-.3-.02-.46.13-.61.14-.14.3-.35.45-.52.15-.17.2-.3.3-.5.1-.2.05-.37-.03-.52-.08-.15-.66-1.58-.9-2.16-.24-.57-.48-.5-.66-.5h-.57c-.2 0-.52.07-.78.37-.27.3-1.02 1-1.02 2.43s1.04 2.8 1.18 3c.15.2 2.04 3.1 4.95 4.34.69.3 1.23.48 1.65.62.7.22 1.33.19 1.83.12.56-.08 1.77-.73 2.02-1.43.25-.7.25-1.3.18-1.43-.07-.13-.27-.2-.57-.35Z" />
        </svg>
      </a>
      <CustomerHome agents={agents} areas={areas} cities={cities} />
    </>
  );
}
