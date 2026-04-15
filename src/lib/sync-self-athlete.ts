import { db } from "@/lib/db"; // tenant-isolation-ok: User/Athlete are not tenant models; sync is user-scoped
import { Prisma } from "@prisma/client";

/**
 * Split a full name into firstName and lastName.
 * First whitespace-delimited token becomes firstName; the rest becomes lastName.
 */
export function splitName(name: string): { firstName: string; lastName: string } {
  const parts = name.trim().split(/\s+/);
  return {
    firstName: parts[0] ?? "",
    lastName: parts.slice(1).join(" "),
  };
}

/**
 * Propagate User fields (name, email, avatar) to the linked self-Athlete record.
 * No-ops silently if the user has no self-athlete.
 */
export async function syncUserToSelfAthlete(userId: string): Promise<void> {
  try {
    const user = await db.user.findUnique({
      where: { id: userId },
      select: { name: true, email: true, avatar: true, avatarCrop: true },
    });
    if (!user) return;

    const selfAthlete = await db.athlete.findUnique({
      where: { userId },
      select: { id: true },
    });
    if (!selfAthlete) return;

    const { firstName, lastName } = splitName(user.name);

    await db.athlete.update({
      where: { userId },
      data: {
        firstName,
        lastName,
        name: user.name,
        email: user.email,
        avatar: user.avatar,
        avatarCrop: (user.avatarCrop as Prisma.InputJsonValue) ?? Prisma.DbNull,
      },
    });
  } catch (error) {
    console.error("syncUserToSelfAthlete failed:", error);
  }
}
