"use client";

import { useEffect, useState } from "react";
import { useRouter, useParams } from "next/navigation";
import BackButton from "@/components/BackButton";

export default function AgentEditPropertyPage() {
  const router = useRouter();
  const params = useParams();
  const [form, setForm] = useState({
    title: "",
    description: "",
    size_value: "",
    size_unit: "marla",
    price: "",
    location: "",
  });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [existingImages, setExistingImages] = useState([]);
  const [newImages, setNewImages] = useState([]);

  useEffect(() => {
    async function loadProperty() {
      const res = await fetch(`/api/properties/${params.id}`);
      if (!res.ok) {
        setError("Property not found.");
        setLoading(false);
        return;
      }
      const data = await res.json();
      setForm({
        title: data.property.title || "",
        description: data.property.description || "",
        size_value: data.property.size_value || "",
        size_unit: data.property.size_unit || "marla",
        price: data.property.price || "",
        location: data.property.location || "",
      });
      setExistingImages(
        (data.property.images || []).map((image) => ({
          ...image,
          pendingDelete: false,
        })),
      );
      setLoading(false);
    }

    loadProperty();
  }, [params.id]);

  function updateExistingImage(imageId, changes) {
    setExistingImages((current) => {
      return current.map((image) =>
        image.id === imageId ? { ...image, ...changes } : image,
      );
    });
  }

  async function handleSubmit(e) {
    e.preventDefault();
    setSaving(true);
    setError("");

    const propertyRes = await fetch(`/api/properties/${params.id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(form),
    });

    if (!propertyRes.ok) {
      const data = await propertyRes.json().catch(() => ({}));
      setSaving(false);
      setError(data.error || "Failed to update property.");
      return;
    }

    const imageUpdates = existingImages
      .filter((image) => !image.pendingDelete)
      .map((image) => ({
        id: image.id,
        title: image.image_title || "",
        isFeatured: Boolean(image.is_featured),
      }));

    if (imageUpdates.length > 0) {
      const imageMetaRes = await fetch(`/api/properties/${params.id}/images`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ updates: imageUpdates }),
      });

      if (!imageMetaRes.ok) {
        const imageData = await imageMetaRes.json().catch(() => ({}));
        setSaving(false);
        setError(imageData.error || "Failed to update image details.");
        return;
      }
    }

    const deletedIds = existingImages
      .filter((image) => image.pendingDelete)
      .map((image) => image.id);

    if (deletedIds.length > 0) {
      const deleteRes = await fetch(`/api/properties/${params.id}/images`, {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ imageIds: deletedIds }),
      });

      if (!deleteRes.ok) {
        const deleteData = await deleteRes.json().catch(() => ({}));
        setSaving(false);
        setError(deleteData.error || "Failed to delete some images.");
        return;
      }
    }

    if (newImages.length > 0) {
      const formData = new FormData();
      newImages.forEach((item) => {
        formData.append("images", item.file);
        formData.append("imageTitles", item.title.trim());
        formData.append("isFeatured", item.isFeatured ? "1" : "0");
      });

      const imageRes = await fetch(`/api/properties/${params.id}/images`, {
        method: "POST",
        body: formData,
      });

      if (!imageRes.ok) {
        const imageData = await imageRes.json().catch(() => ({}));
        setSaving(false);
        setError(
          imageData.error || "Property updated, but image upload failed.",
        );
        return;
      }
    }

    setSaving(false);
    router.push("/agent/dashboard");
  }

  if (loading) {
    return <p style={{ margin: "40px auto", maxWidth: 520 }}>Loading...</p>;
  }

  return (
    <div style={{ maxWidth: 640, margin: "40px auto", padding: "0 16px" }}>
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
      <h1 style={{ marginBottom: 16 }}>Edit Property</h1>
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
        <input
          type="number"
          placeholder="Price (PKR)"
          value={form.price}
          onChange={(e) => setForm({ ...form, price: e.target.value })}
          style={inputStyle}
        />
        <input
          placeholder="Location"
          value={form.location}
          onChange={(e) => setForm({ ...form, location: e.target.value })}
          style={inputStyle}
        />

        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          <p style={{ margin: 0, color: "#334155", fontWeight: 600 }}>
            Existing images
          </p>
          {existingImages.length === 0 ? (
            <p style={{ margin: 0, color: "#64748b" }}>No images yet.</p>
          ) : (
            existingImages
              .filter((image) => !image.pendingDelete)
              .map((image, index) => (
                <div
                  key={image.id}
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
                      src={image.image_url}
                      alt={image.image_title || "Existing property image"}
                      style={{
                        width: 90,
                        height: 70,
                        objectFit: "cover",
                        borderRadius: 8,
                        border: "1px solid #e2e8f0",
                      }}
                    />
                    <div style={{ flex: 1, minWidth: 220 }}>
                      <input
                        placeholder="Image title"
                        value={image.image_title || ""}
                        onChange={(e) =>
                          updateExistingImage(image.id, {
                            image_title: e.target.value,
                          })
                        }
                        style={{ ...inputStyle, width: "100%" }}
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
                          checked={Boolean(image.is_featured)}
                          onChange={(e) => {
                            const next = [...existingImages];
                            next.forEach((item, itemIndex) => {
                              next[itemIndex] = {
                                ...item,
                                is_featured:
                                  itemIndex === index
                                    ? e.target.checked
                                    : false,
                              };
                            });
                            setExistingImages(next);
                          }}
                        />
                        Make featured image
                      </label>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      const next = [...existingImages];
                      next[index] = { ...next[index], pendingDelete: true };
                      setExistingImages(next);
                    }}
                    style={{
                      alignSelf: "flex-start",
                      border: "1px solid #fecaca",
                      background: "#fff1f2",
                      color: "#b91c1c",
                      borderRadius: 999,
                      padding: "7px 10px",
                      cursor: "pointer",
                    }}
                  >
                    Delete image
                  </button>
                </div>
              ))
          )}
        </div>

        <label style={{ color: "#334155" }}>
          Add more images (optional)
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
                isFeatured: false,
              }));
              setNewImages(nextImages);
            }}
            style={{ marginTop: 6 }}
          />
        </label>

        {newImages.length > 0 && (
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            <p style={{ margin: 0, color: "#334155", fontWeight: 600 }}>
              New images
            </p>
            {newImages.map((item, index) => (
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
                <img
                  src={URL.createObjectURL(item.file)}
                  alt={`Preview ${index + 1}`}
                  style={{
                    width: 90,
                    height: 70,
                    objectFit: "cover",
                    borderRadius: 8,
                    border: "1px solid #e2e8f0",
                  }}
                />
                <input
                  placeholder={`Title for image ${index + 1}`}
                  value={item.title}
                  onChange={(e) => {
                    const next = [...newImages];
                    next[index] = { ...next[index], title: e.target.value };
                    setNewImages(next);
                  }}
                  style={inputStyle}
                />
                <label
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 8,
                    color: "#334155",
                    fontSize: 14,
                  }}
                >
                  <input
                    type="checkbox"
                    checked={Boolean(item.isFeatured)}
                    onChange={(e) => {
                      const next = [...newImages];
                      next[index] = {
                        ...next[index],
                        isFeatured: e.target.checked,
                      };
                      setNewImages(next);
                    }}
                  />
                  Make featured image
                </label>
              </div>
            ))}
          </div>
        )}

        {error && <p style={{ color: "#dc2626", margin: 0 }}>{error}</p>}
        <button type="submit" disabled={saving} style={buttonStyle}>
          {saving ? "Saving..." : "Save Changes"}
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
