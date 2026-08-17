import { NextResponse } from "next/server";
import { requireAgent } from "@/lib/adminAuth";
import {
  AUDIT_ACTIONS,
  AUDIT_ENTITY_TYPES,
  createAuditLog,
  getRequestIp,
} from "@/lib/auditLogger";
import { pool } from "@/lib/db";
import {
  MAX_FEATURED_PROPERTIES_PER_AGENT,
  PROPERTY_STATUS,
} from "@/lib/status";

function agentIdFrom(session) {
  return Number(session.user.agent_id || session.user.id);
}

function isFeaturedFlag(value) {
  return value === true || value === 1 || value === "1";
}

const FEATURE_LIMIT_MESSAGE =
  "You can feature up to 10 properties. Remove a featured property before adding another.";

/**
 * Feature an approved listing on the agent's public homepage hero.
 * Ownership comes from the session; never trust a client-supplied agent id.
 */
export async function POST(req, { params }) {
  const { session, error } = await requireAgent();
  if (error) return error;

  const propertyId = Number(params.id);
  if (!Number.isInteger(propertyId) || propertyId <= 0) {
    return NextResponse.json({ error: "Invalid property id." }, { status: 400 });
  }

  const agentId = agentIdFrom(session);
  const conn = await pool.getConnection();

  try {
    await conn.beginTransaction();

    // Serialize feature mutations per agent (10-cap under concurrent POSTs).
    await conn.execute(`SELECT id FROM users WHERE id = ? FOR UPDATE`, [
      agentId,
    ]);

    const [rows] = await conn.execute(
      `SELECT id, title, status, is_featured
       FROM properties
       WHERE id = ? AND agent_id = ?
       FOR UPDATE`,
      [propertyId, agentId],
    );
    const property = rows[0];
    if (!property) {
      await conn.rollback();
      return NextResponse.json({ error: "Property not found." }, { status: 404 });
    }

    if (isFeaturedFlag(property.is_featured)) {
      await conn.commit();
      return NextResponse.json({
        success: true,
        is_featured: true,
        already_featured: true,
      });
    }

    if (property.status !== PROPERTY_STATUS.APPROVED) {
      await conn.rollback();
      return NextResponse.json(
        { error: "Only approved properties can be featured." },
        { status: 403 },
      );
    }

    // Cap uses approved featured only; sold/hidden do not block new slots.
    const [countRows] = await conn.execute(
      `SELECT COUNT(*) AS total
       FROM properties
       WHERE agent_id = ?
         AND is_featured = TRUE
         AND status = ?`,
      [agentId, PROPERTY_STATUS.APPROVED],
    );

    if (Number(countRows[0]?.total) >= MAX_FEATURED_PROPERTIES_PER_AGENT) {
      await conn.rollback();
      return NextResponse.json({ error: FEATURE_LIMIT_MESSAGE }, { status: 409 });
    }

    await conn.execute(
      `UPDATE properties
       SET is_featured = TRUE
       WHERE id = ? AND agent_id = ? AND status = ? AND is_featured = FALSE`,
      [propertyId, agentId, PROPERTY_STATUS.APPROVED],
    );

    await conn.commit();
  } catch (err) {
    try {
      await conn.rollback();
    } catch {
      // ignore rollback errors
    }
    console.error("Failed to feature property:", err);
    return NextResponse.json(
      { error: "Could not feature this property. Please try again." },
      { status: 500 },
    );
  } finally {
    conn.release();
  }

  const agentName = session.user.name || "Agent";
  const agentHandle = session.user.username || session.user.estate_name || null;
  await createAuditLog({
    userId: agentId,
    action: AUDIT_ACTIONS.PROPERTY_UPDATED,
    entityType: AUDIT_ENTITY_TYPES.PROPERTY,
    entityId: propertyId,
    description: `${agentName} featured property #${propertyId}`,
    metadata: {
      agent_name: agentName,
      agent_username: agentHandle,
      estate_name: session.user.estate_name || agentHandle,
      is_featured: true,
    },
    ipAddress: getRequestIp(req),
  });

  return NextResponse.json({ success: true, is_featured: true });
}

/**
 * Remove a listing from the agent's featured homepage set.
 * Does not change approval, publication, or any other property fields.
 */
export async function DELETE(req, { params }) {
  const { session, error } = await requireAgent();
  if (error) return error;

  const propertyId = Number(params.id);
  if (!Number.isInteger(propertyId) || propertyId <= 0) {
    return NextResponse.json({ error: "Invalid property id." }, { status: 400 });
  }

  const agentId = agentIdFrom(session);
  const conn = await pool.getConnection();
  let alreadyUnfeatured = false;

  try {
    await conn.beginTransaction();

    const [rows] = await conn.execute(
      `SELECT id, is_featured
       FROM properties
       WHERE id = ? AND agent_id = ?
       FOR UPDATE`,
      [propertyId, agentId],
    );
    const property = rows[0];
    if (!property) {
      await conn.rollback();
      return NextResponse.json({ error: "Property not found." }, { status: 404 });
    }

    if (!isFeaturedFlag(property.is_featured)) {
      alreadyUnfeatured = true;
      await conn.commit();
    } else {
      await conn.execute(
        `UPDATE properties
         SET is_featured = FALSE
         WHERE id = ? AND agent_id = ?`,
        [propertyId, agentId],
      );
      await conn.commit();
    }
  } catch (err) {
    try {
      await conn.rollback();
    } catch {
      // ignore rollback errors
    }
    console.error("Failed to unfeature property:", err);
    return NextResponse.json(
      { error: "Could not remove this property from featured. Please try again." },
      { status: 500 },
    );
  } finally {
    conn.release();
  }

  if (!alreadyUnfeatured) {
    const agentName = session.user.name || "Agent";
    const agentHandle = session.user.username || session.user.estate_name || null;
    await createAuditLog({
      userId: agentId,
      action: AUDIT_ACTIONS.PROPERTY_UPDATED,
      entityType: AUDIT_ENTITY_TYPES.PROPERTY,
      entityId: propertyId,
      description: `${agentName} removed property #${propertyId} from featured`,
      metadata: {
        agent_name: agentName,
        agent_username: agentHandle,
        estate_name: session.user.estate_name || agentHandle,
        is_featured: false,
      },
      ipAddress: getRequestIp(req),
    });
  }

  return NextResponse.json({
    success: true,
    is_featured: false,
    ...(alreadyUnfeatured ? { already_unfeatured: true } : {}),
  });
}
