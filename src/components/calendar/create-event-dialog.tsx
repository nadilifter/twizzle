"use client";

import { useState, useEffect } from "react";
import { format } from "date-fns";
import { Calendar as CalendarIcon, Clock } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Calendar } from "@/components/ui/calendar";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { useCalendarStore } from "@/store/calendar-store";
import { cn } from "@/lib/utils";
import { useEvents } from "@/hooks/use-events";
import { useUsers } from "@/hooks/use-users";
import { useMemberships } from "@/hooks/use-memberships";
import { toast } from "sonner";

interface CreateEventDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function CreateEventDialog({
  open,
  onOpenChange,
}: CreateEventDialogProps) {
  const { goToDate } = useCalendarStore();
  const { createEvent, isCreating } = useEvents({ autoFetch: false });
  const { users: coaches } = useUsers({ role: "COACH" });
  const { memberships } = useMemberships({ initialParams: { include: "instances" } });

  const [title, setTitle] = useState("");
  const [date, setDate] = useState<Date | undefined>(new Date());
  const [startTime, setStartTime] = useState("");
  const [endTime, setEndTime] = useState("");
  const [meetingLink, setMeetingLink] = useState("");
  const [timezone, setTimezone] = useState("");
  const [capacity, setCapacity] = useState("");
  const [coachId, setCoachId] = useState<string>("none");
  const [requiredMembershipIds, setRequiredMembershipIds] = useState<string[]>([]);
  const [datePickerOpen, setDatePickerOpen] = useState(false);

  useEffect(() => {
    setTimezone(Intl.DateTimeFormat().resolvedOptions().timeZone);
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!title || !date || !startTime || !endTime) {
      return;
    }

    const dateTimeString = `${format(date, "yyyy-MM-dd")}T${startTime}`;
    const eventDate = new Date(dateTimeString);
    const now = new Date();
    // Reset seconds/milliseconds for fair comparison
    now.setSeconds(0, 0);

    if (eventDate < now) {
        toast.error("Event date and time must be in the future");
        return;
    }

    const result = await createEvent({
      title,
      date: format(date, "yyyy-MM-dd"),
      startTime,
      endTime,
      meetingLink: meetingLink || null,
      description: null,
      type: "CLASS", // Default type
      timezone: timezone || null,
      capacity: capacity ? parseInt(capacity) : undefined,
      coachId: coachId === "none" ? null : coachId,
      requiredMembershipInstanceIds: requiredMembershipIds.length > 0 ? requiredMembershipIds : undefined,
    });

    if (result) {
        goToDate(date);
        setTitle("");
        setDate(new Date());
        setStartTime("");
        setEndTime("");
        setMeetingLink("");
        setTimezone(Intl.DateTimeFormat().resolvedOptions().timeZone);
        setCapacity("");
        setCoachId("none");
        setRequiredMembershipIds([]);
        onOpenChange(false);
        toast.success("Event created successfully");
        // Trigger a refresh if possible, or reload
        window.location.reload(); 
    }
  };

  const toggleMembership = (instanceId: string) => {
    setRequiredMembershipIds(prev => 
      prev.includes(instanceId) 
        ? prev.filter(id => id !== instanceId)
        : [...prev, instanceId]
    );
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[600px] max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Create Event</DialogTitle>
          <DialogDescription>
            Add a new event to your calendar. Fill in the details below.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit}>
          <div className="grid gap-4 py-4">
            <div className="grid gap-2">
              <Label htmlFor="title">Title</Label>
              <Input
                id="title"
                placeholder="Event title"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                required
              />
            </div>

            <div className="grid gap-2">
              <Label>Date</Label>
              <Popover open={datePickerOpen} onOpenChange={setDatePickerOpen}>
                <PopoverTrigger asChild>
                  <Button
                    variant="outline"
                    className={cn(
                      "w-full justify-start text-left font-normal",
                      !date && "text-muted-foreground"
                    )}
                  >
                    <CalendarIcon className="mr-2 size-4" />
                    {date ? format(date, "PPP") : <span>Pick a date</span>}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="start">
                  <Calendar
                    mode="single"
                    selected={date}
                    onSelect={(selectedDate) => {
                      setDate(selectedDate);
                      setDatePickerOpen(false);
                    }}
                    initialFocus
                  />
                </PopoverContent>
              </Popover>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="grid gap-2">
                <Label htmlFor="startTime">Start Time</Label>
                <div className="relative">
                  <Clock className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
                  <Input
                    id="startTime"
                    type="time"
                    value={startTime}
                    onChange={(e) => setStartTime(e.target.value)}
                    className="pl-9"
                    required
                  />
                </div>
              </div>

              <div className="grid gap-2">
                <Label htmlFor="endTime">End Time</Label>
                <div className="relative">
                  <Clock className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
                  <Input
                    id="endTime"
                    type="time"
                    value={endTime}
                    onChange={(e) => setEndTime(e.target.value)}
                    className="pl-9"
                    required
                  />
                </div>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
               <div className="grid gap-2">
                <Label htmlFor="capacity">Capacity (Optional)</Label>
                <Input
                  id="capacity"
                  type="number"
                  min="1"
                  placeholder="Unlimited"
                  value={capacity}
                  onChange={(e) => setCapacity(e.target.value)}
                />
              </div>

              <div className="grid gap-2">
                <Label htmlFor="timezone">Timezone</Label>
                <Input
                  id="timezone"
                  placeholder="GMT+7 Pontianak"
                  value={timezone}
                  onChange={(e) => setTimezone(e.target.value)}
                />
              </div>
            </div>

            <div className="grid gap-2">
              <Label htmlFor="coach">Instructor (Optional)</Label>
              <Select value={coachId} onValueChange={setCoachId}>
                <SelectTrigger>
                  <SelectValue placeholder="Select instructor" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">None</SelectItem>
                  {coaches.map((coach) => (
                    <SelectItem key={coach.id} value={coach.id}>
                      {coach.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="grid gap-2">
              <Label>Required Memberships (Optional)</Label>
              <div className="border rounded-md p-4 max-h-40 overflow-y-auto space-y-4">
                {memberships.length === 0 ? (
                  <p className="text-sm text-muted-foreground">No memberships found.</p>
                ) : (
                  memberships.map((group) => (
                    <div key={group.id} className="space-y-2">
                      <p className="text-sm font-semibold sticky top-0 bg-background pb-1">{group.name}</p>
                      {group.instances && group.instances.length > 0 ? (
                        <div className="ml-2 space-y-2">
                           {group.instances.map(instance => (
                             <div key={instance.id} className="flex items-center space-x-2">
                               <Checkbox 
                                  id={instance.id} 
                                  checked={requiredMembershipIds.includes(instance.id)}
                                  onCheckedChange={() => toggleMembership(instance.id)}
                               />
                               <label
                                  htmlFor={instance.id}
                                  className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
                                >
                                  {instance.name}
                                </label>
                             </div>
                           ))}
                        </div>
                      ) : (
                        <p className="ml-2 text-xs text-muted-foreground">No instances</p>
                      )}
                    </div>
                  ))
                )}
              </div>
            </div>

            <div className="grid gap-2">
              <Label htmlFor="meetingLink">Meeting Link (optional)</Label>
              <Input
                id="meetingLink"
                type="url"
                placeholder="https://meet.google.com/..."
                value={meetingLink}
                onChange={(e) => setMeetingLink(e.target.value)}
              />
            </div>

          </div>
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={isCreating}>
              {isCreating ? "Creating..." : "Create Event"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
