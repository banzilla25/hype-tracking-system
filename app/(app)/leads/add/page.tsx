import AddLeadForm from "@/components/add-lead-form";

export default function AddLeadPage() {
  return (
    <div className="max-w-2xl mx-auto px-6 py-8">
      <h1 className="text-xl font-bold text-gray-900 mb-1">Sourcing F&amp;B Mandiri</h1>
      <p className="text-sm text-gray-500 mb-6">
        Tambah POI langsung ke pipeline — melewati alur freelancer.
      </p>
      <AddLeadForm />
    </div>
  );
}
