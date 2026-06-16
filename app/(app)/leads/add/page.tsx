import AddLeadForm from "@/components/add-lead-form";

export default function AddLeadPage() {
  return (
    <div className="max-w-2xl mx-auto px-6 py-8">
      <h1 className="text-xl font-bold text-gray-900 mb-1">Sourcing POI Mandiri</h1>
      <p className="text-sm text-gray-500 mb-6">
        Tambah POI (hotel, F&B, wisata, dll.) langsung ke pipeline — melewati alur freelancer.
      </p>
      <AddLeadForm />
    </div>
  );
}
