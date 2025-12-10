import { Status } from "./types";

export function getStatusVariant(status: string) {
  switch (status) {
    case "planned": return "secondary";
    case "in-progress": return "default"; 
    case "done": return "outline"; // or success styling
    case "under-review": return "destructive"; 
    default: return "secondary";
  }
}

export function formatStatus(status: string) {
  return status.split("-").map(word => word.charAt(0).toUpperCase() + word.slice(1)).join(" ");
}




