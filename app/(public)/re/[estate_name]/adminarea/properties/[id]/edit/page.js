"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { useSession } from "next-auth/react";
import AgentPortalShell from "@/components/agent-portal/AgentPortalShell";
import ui from "@/components/agent-portal/portal.module.css";

export default function EditPropertyPage() {
  const params = useParams();
  const router = useRouter();
  const { data: session, status } = useSession();
  const username = decodeURIComponent(params.estate_name || "");
  const propertyId = params.id;
  const base = `/re/${encodeURIComponent(username)}/adminarea`;

  const [form, setForm] = useState({
    title: "",
    description: "",
    size_value: "",
    size_unit: "marla",
    price: "",
    location: "",
    status: "draft",
  });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [newImages, setNewImages] = useState([]);
  const [currentVideoUrl, setCurrentVideoUrl] = useState("");
  const [newVideo, setNewVideo] = useState(null);
  const [removeVideo, setRemoveVideo] = useState(false);

  useEffect(() => {
    if (status === "unauthenticated") {
      router.replace("/agent/login");
      return;
    }
    if (status !== "authenticated") return;

    (async () => {
      const res = await fetch(`/api/properties/${propertyId}`);
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data.error || "Property not found.");
        setLoading(false);
        return;
      }
      const p = data.property;
      setForm({
        title: p.title || "",
        description: p.description || "",
        size_value: p.size_value || "",
        size_unit: p.size_unit || "marla",
        price: p.price || "",
        location: p.location || "",
        status: p.status || "draft",
      });
      setCurrentVideoUrl(p.video_url || "");
      setLoading(false);
    })();
  }, [status, propertyId, router]);

  async function handleSave(nextStatus) {
    setSaving(true);
    setError("");
    setSuccess("");

    const res = await fetch(`/api/properties/${propertyId}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        ...form,
        size_value: form.size_value ? Number(form.size_value) : null,
        price: form.price ? Number(form.price) : null,
        status: nextStatus || form.status,
      }),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      setError(data.error || "Failed to save.");
      setSaving(false);
      return;
    }

    if (newImages.length > 0) {
      const fd = new FormData();
      newImages.forEach((file, index) => {
        fd.append("images", file);
        fd.append("imageOrder", String(index));
        fd.append("isFeatured", "0");
      });
      await fetch(`/api/properties/${propertyId}/images`, {
        method: "POST",
        body: fd,
      });
      setNewImages([]);
    }

    if (removeVideo && currentVideoUrl) {
      const removeRes = await fetch(`/api/properties/${propertyId}/video`, {
        method: "DELETE",
      });
      const removeData = await removeRes.json().catch(() => ({}));
      if (!removeRes.ok) {
        setError(removeData.error || "Could not remove property video.");
        setSaving(false);
        return;
      }
      setCurrentVideoUrl("");
      setRemoveVideo(false);
    }

    if (newVideo) {
      const fd = new FormData();
      fd.append("video", newVideo);
      const videoRes = await fetch(`/api/properties/${propertyId}/video`, {
        method: "POST",
        body: fd,
      });
      const videoData = await videoRes.json().catch(() => ({}));
      if (!videoRes.ok) {
        setError(videoData.error || "Could not upload property video.");
        setSaving(false);
        return;
      }
      setCurrentVideoUrl(videoData.videoUrl || "");
      setNewVideo(null);
    }

    setForm((prev) => ({ ...prev, status: data.status || nextStatus || prev.status }));
    setSuccess("Property saved.");
    setSaving(false);
  }

  return (
    <AgentPortalShell
      username={username}
      agentName={session?.user?.name}
      title="Edit Property"
      subtitle="Update listing details and submission status"
    >
      <div className={ui.formCard}>
        {loading ? <p className={ui.muted}>Loading…</p> : null}
        {error ? <p className={ui.error}>{error}</p> : null}
        {success ? <p className={ui.success}>{success}</p> : null}

        {!loading ? (
          <>
            <p className={ui.muted}>
              Current status: <strong>{String(form.status).replace(/_/g, " ")}</strong>
            </p>
            <label className={ui.field}>
              <span className={ui.label}>Title</span>
              <input
                className={ui.input}
                value={form.title}
                onChange={(e) => setForm({ ...form, title: e.target.value })}
              />
            </label>
            <div className={ui.field}>
              <span className={ui.label}>Property Video (Optional)</span>
              {currentVideoUrl && !removeVideo ? (
                <>
                  <video controls preload="metadata" src={currentVideoUrl} style={{ width: "100%", borderRadius: "12px" }}>
                    Your browser does not support this video format.
                  </video>
                  <label className={ui.muted}>
                    <input
                      type="checkbox"
                      checked={removeVideo}
                      onChange={(e) => setRemoveVideo(e.target.checked)}
                    />{" "}
                    Remove current video
                  </label>
                </>
              ) : currentVideoUrl ? (
                <p className={ui.muted}>The current video will be removed when you save.</p>
              ) : null}
              <input
                className={ui.input}
                type="file"
                accept="video/mp4,video/webm,video/quicktime,video/ogg,.mp4,.webm,.mov,.ogg"
                onChange={(e) => setNewVideo(e.target.files?.[0] || null)}
              />
              <p className={ui.muted}>MP4, WebM, MOV, or OGG. One video only.</p>
            </div>
            <label className={ui.field}>
              <span className={ui.label}>Description</span>
              <textarea
                className={ui.textarea}
                value={form.description}
                onChange={(e) =>
                  setForm({ ...form, description: e.target.value })
                }
              />
            </label>
            <label className={ui.field}>
              <span className={ui.label}>Location</span>
              <input
                className={ui.input}
                value={form.location}
                onChange={(e) => setForm({ ...form, location: e.target.value })}
              />
            </label>
            <div className={ui.row2}>
              <label className={ui.field}>
                <span className={ui.label}>Size</span>
                <input
                  className={ui.input}
                  type="number"
                  value={form.size_value}
                  onChange={(e) =>
                    setForm({ ...form, size_value: e.target.value })
                  }
                />
              </label>
              <label className={ui.field}>
                <span className={ui.label}>Unit</span>
                <select
                  className={ui.select}
                  value={form.size_unit}
                  onChange={(e) =>
                    setForm({ ...form, size_unit: e.target.value })
                  }
                >
                  <option value="marla">Marla</option>
                  <option value="kanal">Kanal</option>
                  <option value="sqft">Sqft</option>
                </select>
              </label>
            </div>
            <label className={ui.field}>
              <span className={ui.label}>Price (PKR)</span>
              <input
                className={ui.input}
                type="number"
                value={form.price}
                onChange={(e) => setForm({ ...form, price: e.target.value })}
              />
            </label>
            <label className={ui.field}>
              <span className={ui.label}>Add images</span>
              <input
                className={ui.input}
                type="file"
                accept="image/*"
                multiple
                onChange={(e) =>
                  setNewImages(Array.from(e.target.files || []))
                }
              />
            </label>

            <div className={ui.formActions}>
              <button
                type="button"
                className={ui.btnGhost}
                disabled={saving}
                onClick={() => handleSave("draft")}
              >
                Save Draft
              </button>
              <button
                type="button"
                className={ui.btnPrimary}
                disabled={saving}
                onClick={() => handleSave("pending_approval")}
              >
                Submit For Approval
              </button>
              <button
                type="button"
                className={ui.btnGhost}
                onClick={() => router.push(`${base}/properties`)}
              >
                Back to list
              </button>
            </div>
          </>
        ) : null}
      </div>
    </AgentPortalShell>
  );
}
