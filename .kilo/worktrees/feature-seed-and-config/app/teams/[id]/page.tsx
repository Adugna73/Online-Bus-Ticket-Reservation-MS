import TeamDetails from "@/components/TeamDetails";

export default async function TeamPage({
    params,
}: {
    params: Promise<{ id: string }>;
}) {
    const { id } = await params;
    return (
        <div className="max-w-7xl mx-auto py-8 px-6">
            <h1 className="text-2xl font-semibold mb-6">Team</h1>
            <TeamDetails id={id} />
        </div>
    );
}
