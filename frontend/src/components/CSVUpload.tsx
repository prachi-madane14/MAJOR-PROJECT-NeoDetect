import { useState } from "react";

export default function CSVUpload() {

  const [file, setFile] = useState<File | null>(null);
  const [results, setResults] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);

  const handleUpload = async () => {

    if (!file) {
      alert("Upload a CSV first");
      return;
    }

    setLoading(true);

    const formData = new FormData();
    formData.append("file", file);

    try {

      const response = await fetch("http://127.0.0.1:8000/predict_csv", {
        method: "POST",
        body: formData
      });

      const data = await response.json();

      setResults(data.results);

    } catch (err) {

      console.error(err);
      alert("Backend error");

    }

    setLoading(false);
  };

  return (
    <div className="mt-12 p-6 bg-white rounded-2xl shadow-lg">

      <h2 className="text-xl font-bold mb-4">
        Upload CSV for Prediction
      </h2>

      <input
        type="file"
        accept=".csv"
        onChange={(e) => setFile(e.target.files?.[0] || null)}
      />

      <button
        onClick={handleUpload}
        className="ml-4 bg-blue-500 text-white px-4 py-2 rounded"
      >
        {loading ? "Processing..." : "Upload & Predict"}
      </button>

      {results.length > 0 && (

        <table className="mt-6 w-full border">

          <thead>
            <tr className="bg-gray-200">
              <th className="p-2">Prediction</th>
              <th className="p-2">Confidence</th>
              <th className="p-2">Status</th>
            </tr>
          </thead>

          <tbody>
            {results.map((r, i) => (
              <tr key={i} className="border">
                <td className="p-2">{r.prediction}</td>
                <td className="p-2">{r.confidence}%</td>
                <td className="p-2">{r.status}</td>
              </tr>
            ))}
          </tbody>

        </table>

      )}

    </div>
  );
}