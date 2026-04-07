"use client";

import Link from "next/link";
import { ProgressiveImage } from "@/components/ui/progressive-image";
import { ArrowRight } from "lucide-react";

interface CategoryTile {
  id: string;
  name: string;
  description: string | null;
  imageUrl: string | null;
  _count: {
    programs: number;
    events: number;
    competitions: number;
  };
}

interface CategoryTilesProps {
  categories: CategoryTile[];
  hasUncategorizedPrograms: boolean;
  primaryColor: string;
  allProgramsImageUrl?: string | null;
}

export function CategoryTiles({
  categories,
  hasUncategorizedPrograms,
  primaryColor,
  allProgramsImageUrl,
}: CategoryTilesProps) {
  const tiles: CategoryTile[] = [
    {
      id: "all",
      name: "All Programs",
      description: "Browse all available programs",
      imageUrl: allProgramsImageUrl ?? null,
      _count: { programs: 0, events: 0, competitions: 0 },
    },
    ...categories,
    ...(hasUncategorizedPrograms
      ? [
          {
            id: "other",
            name: "Other Programs",
            description: "Browse additional programs",
            imageUrl: null as string | null,
            _count: { programs: 0, events: 0, competitions: 0 },
          },
        ]
      : []),
  ];

  return (
    <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
      {tiles.map((category) => (
        <Link
          key={category.id}
          href={category.id === "all" ? "/register" : `/register?category=${category.id}`}
          className="group relative flex flex-col overflow-hidden rounded-2xl border bg-card shadow-sm transition-all hover:shadow-lg hover:-translate-y-0.5"
        >
          <div className="relative aspect-video w-full overflow-hidden bg-muted">
            {category.imageUrl ? (
              <ProgressiveImage
                src={category.imageUrl}
                alt={category.name}
                fill
                className="object-cover transition-transform duration-300 group-hover:scale-105"
                sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 33vw"
              />
            ) : (
              <div
                className="absolute inset-0 opacity-20"
                style={{
                  background: `linear-gradient(135deg, ${primaryColor}, ${primaryColor}80)`,
                }}
              />
            )}
            <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-black/20 to-transparent" />
            <div className="absolute bottom-0 left-0 right-0 p-5">
              <h3 className="text-xl font-bold text-white drop-shadow-md">{category.name}</h3>
              {category.description && (
                <p className="mt-1 text-sm text-white/80 line-clamp-2 drop-shadow-sm">
                  {category.description}
                </p>
              )}
            </div>
          </div>
          <div className="flex items-center justify-between p-4">
            <span className="text-sm text-muted-foreground">Browse programs</span>
            <ArrowRight className="h-4 w-4 text-muted-foreground transition-transform group-hover:translate-x-1" />
          </div>
        </Link>
      ))}
    </div>
  );
}
