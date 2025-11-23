import ClaimPageClient from "./claim-page-client";

interface ClaimPageProps {
  params: Promise<{
    id: string;
  }>;
}

export default async function ClaimPage({ params }: ClaimPageProps) {
  const { id } = await params;

  return <ClaimPageClient cpopId={id} />;
}
