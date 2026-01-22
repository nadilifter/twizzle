import { getEventById } from "@/mock-data/events";
import { notFound } from "next/navigation";
import { Map, MapMarker, MapPopup, MapTileLayer, MapZoomControl } from "@/components/ui/map";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ArrowLeft, Calendar, Clock, MapPin, Users, User, Info, CheckCircle2, ClipboardList, HelpCircle } from "lucide-react";
import Link from "next/link";
import { format } from "date-fns";
import { Separator } from "@/components/ui/separator";

interface EventPageProps {
  params: {
    id: string;
  };
}

function getInitials(name: string) {
    const parts = name.split(' ');
    if (parts.length >= 2) {
        return `${parts[0][0]}${parts[1][0]}`.toUpperCase();
    }
    return name.substring(0, 2).toUpperCase();
}

export default function EventPage({ params }: EventPageProps) {
  const event = getEventById(params.id);

  if (!event) {
    notFound();
  }

  return (
    <div className="container mx-auto py-8 px-4">
      <div className="mb-6">
        <Button variant="ghost" asChild>
          <Link href="/dashboard/events" className="flex items-center gap-2">
            <ArrowLeft className="h-4 w-4" />
            Back to Events
          </Link>
        </Button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        <div className="lg:col-span-2 space-y-8">
          {/* Header Section */}
          <div>
            <div className="flex items-center gap-3 mb-3">
                {event.type && (
                    <Badge variant="secondary" className="text-sm font-medium">
                        {event.type}
                    </Badge>
                )}
            </div>
            <h1 className="text-4xl font-bold tracking-tight text-foreground">{event.title}</h1>
            <div className="flex flex-wrap gap-6 mt-6 text-muted-foreground">
              <div className="flex items-center gap-2">
                <Calendar className="h-5 w-5 text-primary" />
                <span className="font-medium text-foreground">{format(new Date(event.date), "EEEE, MMMM d, yyyy")}</span>
              </div>
              <div className="flex items-center gap-2">
                <Clock className="h-5 w-5 text-primary" />
                <span className="font-medium text-foreground">
                  {event.startTime} - {event.endTime}
                  {event.timezone ? ` (${event.timezone})` : ""}
                </span>
              </div>
            </div>
          </div>

          {/* Location Map */}
          {event.location ? (
             <div className="h-[400px] w-full rounded-xl border overflow-hidden relative z-0 shadow-sm">
              <Map center={[event.location.lat, event.location.lng]} zoom={15}>
                <MapTileLayer
                  url="https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}.png"
                  attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors &copy; <a href="https://carto.com/attributions">CARTO</a>'
                />
                <MapZoomControl />
                <MapMarker position={[event.location.lat, event.location.lng]}>
                  <MapPopup>
                    <div className="p-2">
                      <h3 className="font-bold">{event.location.name || event.title}</h3>
                      <p className="text-sm text-muted-foreground">{event.location.address}</p>
                    </div>
                  </MapPopup>
                </MapMarker>
              </Map>
            </div>
          ) : (
            <div className="bg-muted rounded-xl p-8 text-center border">
                <MapPin className="h-8 w-8 mx-auto mb-2 text-muted-foreground" />
                <p className="text-muted-foreground">No location information available</p>
            </div>
          )}

          {/* About Section */}
          <div className="space-y-6">
              <div>
                <h2 className="text-2xl font-bold tracking-tight mb-4">About this event</h2>
                <p className="text-muted-foreground leading-relaxed text-lg">
                    {event.description || `Join us for ${event.title}. This event will take place on ${format(new Date(event.date), "MMMM d")} from ${event.startTime} to ${event.endTime}.`}
                </p>
              </div>

              {event.details && (
                <div className="grid gap-6 md:grid-cols-2">
                    {event.details.whatToExpect && (
                        <div className="bg-card rounded-lg border p-5 shadow-sm">
                            <div className="flex items-center gap-2 mb-3">
                                <HelpCircle className="h-5 w-5 text-primary" />
                                <h3 className="font-semibold text-lg">What to Expect</h3>
                            </div>
                            <p className="text-muted-foreground text-sm leading-relaxed">
                                {event.details.whatToExpect}
                            </p>
                        </div>
                    )}
                    
                    {event.details.requirements && (
                        <div className="bg-card rounded-lg border p-5 shadow-sm">
                            <div className="flex items-center gap-2 mb-3">
                                <CheckCircle2 className="h-5 w-5 text-primary" />
                                <h3 className="font-semibold text-lg">Requirements</h3>
                            </div>
                            <p className="text-muted-foreground text-sm leading-relaxed">
                                {event.details.requirements}
                            </p>
                        </div>
                    )}

                    {event.details.whatToBring && event.details.whatToBring.length > 0 && (
                        <div className="bg-card rounded-lg border p-5 shadow-sm md:col-span-2">
                             <div className="flex items-center gap-2 mb-3">
                                <ClipboardList className="h-5 w-5 text-primary" />
                                <h3 className="font-semibold text-lg">What to Bring</h3>
                            </div>
                            <ul className="grid grid-cols-1 md:grid-cols-2 gap-2">
                                {event.details.whatToBring.map((item, i) => (
                                    <li key={i} className="flex items-center gap-2 text-sm text-muted-foreground">
                                        <div className="h-1.5 w-1.5 rounded-full bg-primary shrink-0" />
                                        {item}
                                    </li>
                                ))}
                            </ul>
                        </div>
                    )}
                </div>
              )}
              
              {event.meetingLink && (
                  <div className="mt-6 p-4 bg-primary/5 border-primary/20 border rounded-lg flex items-start gap-3">
                      <Info className="h-5 w-5 text-primary mt-0.5" />
                      <div>
                          <p className="font-medium text-foreground">Online Meeting</p>
                          <a href={event.meetingLink} className="text-primary hover:underline break-all font-medium" target="_blank" rel="noreferrer">
                              {event.meetingLink}
                          </a>
                      </div>
                  </div>
              )}
          </div>
        </div>

        {/* Sidebar */}
        <div className="space-y-6">
          {/* Attendees Card */}
          <div className="rounded-xl border bg-card text-card-foreground shadow-sm">
            <div className="p-6">
                <div className="flex items-center justify-between mb-4">
                    <div className="flex items-center gap-2">
                        <Users className="h-5 w-5 text-muted-foreground" />
                        <h2 className="font-semibold text-lg">Attendees</h2>
                    </div>
                    <Badge variant="outline" className="text-xs">{event.participants.length}</Badge>
                </div>
                <Separator className="mb-4" />
                <div className="space-y-4">
                    {event.participants.length > 0 ? (
                        <div className="flex flex-col gap-3">
                            {event.participants.map((participant, index) => (
                                <div key={index} className="flex items-center gap-3">
                                    <Avatar className="h-8 w-8 border">
                                        <AvatarFallback className="text-xs font-medium bg-primary/10 text-primary">
                                            {getInitials(participant)}
                                        </AvatarFallback>
                                    </Avatar>
                                    <span className="text-sm font-medium">{participant}</span>
                                </div>
                            ))}
                        </div>
                    ) : (
                        <p className="text-sm text-muted-foreground italic">No confirmed attendees yet.</p>
                    )}
                </div>
            </div>
          </div>
          
           {/* Event Leader Card */}
           {event.coach && (
                <div className="rounded-xl border bg-card text-card-foreground shadow-sm">
                    <div className="p-6">
                        <div className="flex items-center gap-2 mb-4">
                            <User className="h-5 w-5 text-muted-foreground" />
                            <h2 className="font-semibold text-lg">Event Leader</h2>
                        </div>
                        <Separator className="mb-4" />
                        <div className="flex items-center gap-4">
                            <Avatar className="h-12 w-12 border-2 border-primary/20">
                                <AvatarFallback className="text-lg font-semibold bg-primary text-primary-foreground">
                                    {getInitials(event.coach)}
                                </AvatarFallback>
                            </Avatar>
                            <div>
                                <p className="font-semibold text-base">{event.coach}</p>
                                <p className="text-sm text-muted-foreground">Coach / Instructor</p>
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </div>
      </div>
    </div>
  );
}
