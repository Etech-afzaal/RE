"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import BackButton from "@/components/BackButton";
import ImageCategorySelect from "@/components/ImageCategorySelect";

export default function AgentNewPropertyPage() {
  const router = useRouter();
  const [form, setForm] = useState({
    title: "",
    description: "",
    size_value: "",
    size_unit: "marla",
    price: "",
    price_currency: "PKR",
    location: "",
  });
  const [selectedImages, setSelectedImages] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function handleSubmit(e) {
    e.preventDefault();
    setLoading(true);
    setError("");

    const res = await fetch("/api/properties", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(form),
    });

    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      setError(data.error || "Failed to create property.");
      setLoading(false);
      return;
    }

    const { propertyId } = await res.json();

    if (selectedImages.length > 0) {
      const formData = new FormData();
      selectedImages.forEach((item, index) => {
        formData.append("images", item.file);
        formData.append("imageTitles", item.title.trim());
        formData.append("imageOrder", String(index));
        formData.append("imageCategories", item.category || "");
        formData.append("isFeatured", item.isFeatured ? "1" : "0");
      });

      const imgRes = await fetch(`/api/properties/${propertyId}/images`, {
        method: "POST",
        body: formData,
      });

      if (!imgRes.ok) {
        setError(
          "Property was created, but image upload failed. You can retry from the edit page.",
        );
        setLoading(false);
        return;
      }
    }

    router.push("/agent/dashboard");
  }

  return (
    <div style={{ maxWidth: 520, margin: "40px auto", padding: "0 16px" }}>
      <BackButton
        fallbackHref="/agent/dashboard"
        label="← Back"
        style={{
          border: "none",
          background: "transparent",
          color: "#2563eb",
          fontWeight: 700,
          cursor: "pointer",
          padding: 0,
          marginBottom: 12,
        }}
      />
      <h1 style={{ marginBottom: 16 }}>Add Property</h1>
      <form
        onSubmit={handleSubmit}
        style={{ display: "flex", flexDirection: "column", gap: 12 }}
      >
        <input
          required
          placeholder="Property title"
          value={form.title}
          onChange={(e) => setForm({ ...form, title: e.target.value })}
          style={inputStyle}
        />
        <textarea
          placeholder="Description"
          value={form.description}
          onChange={(e) => setForm({ ...form, description: e.target.value })}
          style={{ ...inputStyle, minHeight: 90 }}
        />
        <div style={{ display: "flex", gap: 8 }}>
          <input
            type="number"
            step="0.01"
            placeholder="Size"
            value={form.size_value}
            onChange={(e) => setForm({ ...form, size_value: e.target.value })}
            style={{ ...inputStyle, flex: 1 }}
          />
          <select
            value={form.size_unit}
            onChange={(e) => setForm({ ...form, size_unit: e.target.value })}
            style={{ ...inputStyle, flex: 1 }}
          >
            <option value="marla">Marla</option>
            <option value="kanal">Kanal</option>
            <option value="sqft">Sqft</option>
          </select>
        </div>
        <div style={{ display: "flex", gap: 8 }}>
          <input
            type="number"
            placeholder="Price"
            value={form.price}
            onChange={(e) => setForm({ ...form, price: e.target.value })}
            style={{ ...inputStyle, flex: 1 }}
          />
          <select
            value={form.price_currency}
            onChange={(e) =>
              setForm({ ...form, price_currency: e.target.value })
            }
            style={{ ...inputStyle, flex: "0 0 110px" }}
            aria-label="Price currency"
          >
            <option value="PKR">PKR</option>
            <option value="USD">$ USD</option>
          </select>
        </div>
        <input
          placeholder="Location"
          value={form.location}
          onChange={(e) => setForm({ ...form, location: e.target.value })}
          style={inputStyle}
        />
        <label style={{ color: "#334155" }}>
          Images (will be watermarked automatically)
          <input
            type="file"
            multiple
            accept="image/*"
            onChange={(e) => {
              const files = Array.from(e.target.files || []);
              const nextImages = files.map((file, index) => ({
                file,
                title:
                  file.name.replace(/\.[^.]+$/, "") || `Image ${index + 1}`,
                order: index,
                category: "",
                isFeatured: index === 0,
              }));
              setSelectedImages(nextImages);
            }}
            style={{ marginTop: 6 }}
          />
        </label>
        {selectedImages.length > 0 && (
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            <p style={{ margin: 0, color: "#334155", fontWeight: 600 }}>
              Image titles
            </p>
            {selectedImages.map((item, index) => (
              <div
                key={`${item.file.name}-${index}`}
                style={{
                  border: "1px solid #e2e8f0",
                  borderRadius: 10,
                  padding: 10,
                  display: "flex",
                  flexDirection: "column",
                  gap: 8,
                }}
              >
                <div
                  style={{
                    display: "flex",
                    gap: 10,
                    alignItems: "flex-start",
                    flexWrap: "wrap",
                  }}
                >
                  <img
                    src={URL.createObjectURL(item.file)}
                    alt={`Preview ${index + 1}`}
                    style={{
                      width: 90,
                      height: 70,
                      objectFit: "cover",
                      borderRadius: 8,
                      border: "1px solid #e2e8f0",
                      background: "#f8fafc",
                    }}
                  />
                  <div style={{ flex: 1, minWidth: 220 }}>
                    <span style={{ fontSize: 13, color: "#64748b" }}>
                      {item.file.name}
                    </span>
                    <input
                      placeholder={`Title for image ${index + 1}`}
                      value={item.title}
                      onChange={(e) => {
                        const next = [...selectedImages];
                        next[index] = { ...next[index], title: e.target.value };
                        setSelectedImages(next);
                      }}
                      style={{ ...inputStyle, marginTop: 6, width: "100%" }}
                    />
                    <ImageCategorySelect
                      value={item.category}
                      ariaLabel={`Category for image ${index + 1}`}
                      onChange={(category) => {
                        const next = [...selectedImages];
                        next[index] = {
                          ...next[index],
                          category: category || "",
                        };
                        setSelectedImages(next);
                      }}
                      style={{ ...inputStyle, marginTop: 6, width: "100%" }}
                    />
                    <label
                      style={{
                        display: "flex",
                        alignItems: "center",
                        gap: 8,
                        color: "#334155",
                        fontSize: 14,
                        marginTop: 6,
                      }}
                    >
                      <input
                        type="checkbox"
                        checked={Boolean(item.isFeatured)}
                        onChange={(e) => {
                          const next = [...selectedImages];
                          next.forEach((image, imageIndex) => {
                            next[imageIndex] = {
                              ...image,
                              isFeatured:
                                imageIndex === index ? e.target.checked : false,
                            };
                          });
                          setSelectedImages(next);
                        }}
                      />
                      Make featured image
                    </label>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
        {error && <p style={{ color: "#dc2626", margin: 0 }}>{error}</p>}
        <button type="submit" disabled={loading} style={buttonStyle}>
          {loading ? "Saving..." : "Save Property"}
        </button>
      </form>
    </div>
  );
}

const inputStyle = {
  border: "1px solid #cbd5e1",
  borderRadius: 10,
  padding: "12px 14px",
  fontSize: 15,
};

const buttonStyle = {
  border: "none",
  borderRadius: 999,
  padding: "12px 16px",
  fontWeight: 700,
  color: "#fff",
  background: "linear-gradient(135deg, #2563eb 0%, #0f766e 100%)",
  cursor: "pointer",
};
