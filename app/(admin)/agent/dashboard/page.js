"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import LogoutButton from "@/components/LogoutButton";
import ActionMenu from "@/components/ActionMenu";
import { isAgentRole } from "@/lib/roles";

export default function AgentDashboardPage() {
  const router = useRouter();
  const [properties, setProperties] = useState([]);
  const [agentName, setAgentName] = useState("");
  const [agentEmail, setAgentEmail] = useState("");
  const [estateName, setEstateName] = useState("");
  const [profileImage, setProfileImage] = useState(null);
  const [selectedProfileImage, setSelectedProfileImage] = useState(null);
  const [profileImagePreview, setProfileImagePreview] = useState(null);
  const [profileImageError, setProfileImageError] = useState("");
  const [uploadingProfileImage, setUploadingProfileImage] = useState(false);
  const [loading, setLoading] = useState(true);

  const displayEstateName = formatEstateName(estateName);

  useEffect(() => {
    async function loadDashboard() {
      const sessionRes = await fetch("/api/auth/session");
      const sessionData = await sessionRes.json();
      const sessionUser = sessionData?.user;

      if (!sessionUser) {
        router.replace("/agent/login");
        return;
      }

      if (!isAgentRole(sessionUser.role)) {
        router.replace("/admin/dashboard");
        return;
      }

      const handle = sessionUser.username || sessionUser.estate_name;
      if (handle) {
        router.replace(`/re/${encodeURIComponent(handle)}/adminarea`);
        return;
      }

      setAgentName(sessionUser.name || "");
      setAgentEmail(sessionUser.email || "");
      setEstateName(sessionUser.estate_name || "");

      const [propertiesRes, profileImageRes] = await Promise.all([
        fetch("/api/properties"),
        fetch("/api/agent/profile-image"),
      ]);
      if (propertiesRes.ok) {
        const data = await propertiesRes.json();
        setProperties(data.properties || []);
      }
      if (profileImageRes.ok) {
        const data = await profileImageRes.json();
        setProfileImage(data.profile_image || null);
      }
      setLoading(false);
    }

    loadDashboard();
  }, [router]);

  useEffect(() => {
    if (!selectedProfileImage) {
      setProfileImagePreview(null);
      return undefined;
    }
    const previewUrl = URL.createObjectURL(selectedProfileImage);
    setProfileImagePreview(previewUrl);
    return () => URL.revokeObjectURL(previewUrl);
  }, [selectedProfileImage]);

  async function handleDelete(propertyId) {
    if (!confirm("Delete this property?")) return;

    const res = await fetch(`/api/properties/${propertyId}`, {
      method: "DELETE",
    });

    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      alert(data.error || "Failed to delete property.");
      return;
    }

    setProperties((prev) =>
      prev.filter((property) => property.id !== propertyId),
    );
  }

  async function handleProfileImageChange(e) {
    const image = e.target.files?.[0];
    if (!image) return;

    setProfileImageError("");
    setSelectedProfileImage(image);
    e.target.value = "";
  }

  async function saveProfileImage() {
    if (!selectedProfileImage) return;

    setUploadingProfileImage(true);
    setProfileImageError("");

    const formData = new FormData();
    formData.append("image", selectedProfileImage);

    try {
      const res = await fetch("/api/agent/profile-image", {
        method: "POST",
        body: formData,
      });
      const data = await res.json().catch(() => ({}));

      if (!res.ok) {
        setProfileImageError(data.error || "Could not upload your image.");
        return;
      }

      setProfileImage(data.profile_image || null);
      setSelectedProfileImage(null);
    } catch {
      setProfileImageError("Could not upload your image. Please try again.");
    } finally {
      setUploadingProfileImage(false);
    }
  }

  if (loading) {
    return <p style={{ margin: "40px auto", maxWidth: 860 }}>Loading...</p>;
  }

  return (
    <div style={{ maxWidth: 860, margin: "40px auto", padding: "0 16px" }}>
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          gap: 12,
          flexWrap: "wrap",
          marginBottom: 24,
        }}
      >
        <div>
          <h1 style={{ margin: 0, color: "#0f172a" }}>Agent Dashboard</h1>
          <p style={{ margin: "6px 0 0", color: "#475569" }}>
            Manage your properties and share your public estate page.
          </p>
          <div
            style={{
              marginTop: 10,
              display: "flex",
              flexWrap: "wrap",
              gap: 12,
              color: "#334155",
              fontSize: 14,
            }}
          >
            {agentName && <span>👤 {agentName}</span>}
            {agentEmail && (
              <span>
                ✉️{" "}
                <a
                  href={`mailto:${agentEmail}`}
                  style={{ color: "inherit", textDecoration: "none" }}
                >
                  {agentEmail}
                </a>
              </span>
            )}
            {displayEstateName && <span>🏠 {displayEstateName}</span>}
          </div>
        </div>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          <Link href="/agent/properties/new">
            <button
              style={{
                border: "none",
                borderRadius: 999,
                padding: "10px 16px",
                fontWeight: 700,
                color: "#fff",
                background: "linear-gradient(135deg, #2563eb 0%, #0f766e 100%)",
                cursor: "pointer",
              }}
            >
              + Add Property
            </button>
          </Link>
          <LogoutButton
            callbackUrl="/agent/login"
            label="Logout"
            style={{
              border: "none",
              borderRadius: 999,
              padding: "10px 16px",
              fontWeight: 700,
              color: "#fff",
              background: "#dc2626",
              cursor: "pointer",
            }}
          />
        </div>
      </div>

      <div
        style={{
          background: "#fff",
          border: "1px solid #e2e8f0",
          borderRadius: 16,
          padding: 18,
          marginBottom: 20,
          boxShadow: "0 10px 30px rgba(15, 23, 42, 0.06)",
        }}
      >
        <p style={{ margin: 0, color: "#334155" }}>
          Your public page:{" "}
          <a
            href={`/re/${encodeURIComponent(estateName || "")}`}
            style={{ color: "#2563eb", fontWeight: 600 }}
            target="_blank"
          >
            /re/{displayEstateName}
          </a>
        </p>
      </div>

      <div
        style={{
          background: "#fff",
          border: "1px solid #e2e8f0",
          borderRadius: 16,
          padding: 18,
          marginBottom: 20,
          boxShadow: "0 10px 30px rgba(15, 23, 42, 0.06)",
        }}
      >
        <h2 style={{ margin: "0 0 8px", fontSize: 18 }}>Profile picture</h2>
        <p style={{ margin: "0 0 14px", color: "#64748b", fontSize: 14 }}>
          Use an image up to 5 MB. It appears on your public profile and agent
          cards.
        </p>
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 14,
            flexWrap: "wrap",
          }}
        >
          <AgentAvatar
            src={profileImagePreview || profileImage}
            alt="Your profile"
            width={72}
            height={72}
            style={{ borderRadius: "50%", objectFit: "cover" }}
          />
          <label
            style={{
              display: "inline-flex",
              alignItems: "center",
              borderRadius: 999,
              padding: "10px 16px",
              fontWeight: 700,
              color: "#fff",
              background: "linear-gradient(135deg, #2563eb 0%, #0f766e 100%)",
              cursor: uploadingProfileImage ? "wait" : "pointer",
              opacity: uploadingProfileImage ? 0.7 : 1,
            }}
          >
            <input
              type="file"
              accept="image/*"
              onChange={handleProfileImageChange}
              disabled={uploadingProfileImage}
              style={{ display: "none" }}
            />
            {uploadingProfileImage ? "Uploading..." : "Upload picture"}
          </label>
          {selectedProfileImage ? (
            <button
              type="button"
              onClick={saveProfileImage}
              disabled={uploadingProfileImage}
              style={{
                border: "none",
                borderRadius: 999,
                padding: "10px 16px",
                fontWeight: 700,
                color: "#fff",
                background: "#0f766e",
                cursor: uploadingProfileImage ? "wait" : "pointer",
              }}
            >
              Save picture
            </button>
          ) : null}
        </div>
        {profileImageError ? (
          <p style={{ margin: "12px 0 0", color: "#b91c1c", fontSize: 14 }}>
            {profileImageError}
          </p>
        ) : null}
      </div>

      <div
        style={{
          background: "#fff",
          border: "1px solid #e2e8f0",
          borderRadius: 16,
          padding: 18,
          boxShadow: "0 10px 30px rgba(15, 23, 42, 0.06)",
        }}
      >
        <h2 style={{ marginTop: 0, fontSize: 18 }}>Your Properties</h2>
        {properties.length === 0 ? (
          <p style={{ margin: 0, color: "#64748b" }}>
            You haven&apos;t added any properties yet.
          </p>
        ) : (
          <ul
            style={{
              listStyle: "none",
              padding: 0,
              margin: 0,
              display: "grid",
              gap: 12,
            }}
          >
            {properties.map((property) => (
              <li
                key={property.id}
                style={{
                  position: "relative",
                  border: "1px solid #e2e8f0",
                  borderRadius: 12,
                  padding: "12px 44px 12px 12px",
                  background: "#f8fafc",
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "flex-start",
                  gap: 12,
                  flexWrap: "wrap",
                }}
              >
                <div>
                  <strong style={{ color: "#0f172a" }}>{property.title}</strong>
                  <span style={{ color: "#475569" }}>
                    {" "}
                    — {property.size_value} {property.size_unit}
                  </span>
                </div>
                <div style={{ position: "absolute", top: 8, right: 8 }}>
                  <ActionMenu
                    ariaLabel={`Actions for ${property.title}`}
                    onEdit={() => router.push(`/agent/properties/${property.id}/edit`)}
                    onDelete={() => handleDelete(property.id)}
                  />
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
function formatEstateName(value) {
  if (!value) return "";

  return String(value)
    .replace(/[-_]+/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .replace(/\b\w/g, (char) => char.toUpperCase());
}
