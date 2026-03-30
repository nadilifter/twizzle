"use client";

import { useRouter, usePathname } from "next/navigation";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

interface Sport {
  id: string;
  name: string;
  slug: string;
}

interface SportFilterProps {
  sports: Sport[];
  currentSport?: string;
}

export function SportFilter({ sports, currentSport }: SportFilterProps) {
  const router = useRouter();
  const pathname = usePathname();

  const handleChange = (value: string) => {
    if (value === "all") {
      router.push(pathname);
    } else {
      router.push(`${pathname}?sport=${value}`);
    }
  };

  return (
    <Select value={currentSport || "all"} onValueChange={handleChange}>
      <SelectTrigger className="w-[200px]">
        <SelectValue placeholder="Filter by sport" />
      </SelectTrigger>
      <SelectContent>
        <SelectItem value="all">All Sports</SelectItem>
        {sports.map((sport) => (
          <SelectItem key={sport.id} value={sport.slug}>
            {sport.name}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
