"use client";

import { useState, useEffect, useCallback } from "react";
import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Loader2, Eye, AlertCircle, CheckCircle2, Search, X } from "lucide-react";

interface UserResult {
  id: string;
  name: string | null;
  email: string;
  role: string | null;
  avatar: string | null;
  status: string;
  isSuperAdmin: boolean;
}

export default function CoachViewAsUserPage() {
  const { data: session, update: updateSession } = useSession();
  const router = useRouter();

  const [query, setQuery] = useState("");
  const [users, setUsers] = useState<UserResult[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [isStartingView, setIsStartingView] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const isCurrentlyViewing = !!session?.user?.viewingAsUserId;

  useEffect(() => {
    if (session && !session.user?.isSuperAdmin) {
      router.push("/coach");
    }
  }, [session, router]);

  const searchUsers = useCallback(async (searchQuery: string) => {
    if (searchQuery.length < 2) {
      setUsers([]);
      return;
    }
    setIsSearching(true);
    setError(null);
    try {
      const res = await fetch(`/api/superadmin/users/search?q=${encodeURIComponent(searchQuery)}`);
      if (!res.ok) throw new Error("Failed to search users");
      const data = await res.json();
      setUsers(data.users || []);
    } catch (err) {
      setError("Failed to search users");
      console.error(err);
    } finally {
      setIsSearching(false);
    }
  }, []);

  useEffect(() => {
    const timer = setTimeout(() => {
      searchUsers(query);
    }, 300);
    return () => clearTimeout(timer);
  }, [query, searchUsers]);

  const handleStartViewing = async (user: UserResult) => {
    setIsStartingView(true);
    setError(null);
    try {
      await updateSession({
        viewingAsUserId: user.id,
        viewingAsUserName: user.name || user.email,
        viewingAsUserEmail: user.email,
      });
      router.push("/coach");
    } catch (err) {
      setError("Failed to start viewing as user");
      console.error(err);
      setIsStartingView(false);
    }
  };

  const handleStopViewing = async () => {
    setIsStartingView(true);
    try {
      await updateSession({
        viewingAsUserId: "",
        viewingAsUserName: "",
        viewingAsUserEmail: "",
      });
      router.refresh();
    } catch (err) {
      setError("Failed to stop viewing as user");
      console.error(err);
    } finally {
      setIsStartingView(false);
    }
  };

  const getInitials = (name: string | null) => {
    if (!name) return "?";
    return name
      .split(" ")
      .map((n) => n[0])
      .join("")
      .toUpperCase()
      .slice(0, 2);
  };

  if (!session?.user?.isSuperAdmin) {
    return null;
  }

  return (
    <div className="space-y-6 max-w-3xl">
      <div>
        <h1 className="text-2xl font-bold">View as User</h1>
        <p className="text-muted-foreground">
          Search for any user to view the coach portal from their perspective. Useful for testing
          and troubleshooting.
        </p>
      </div>

      {error && (
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertTitle>Error</AlertTitle>
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      {isCurrentlyViewing && (
        <Alert>
          <CheckCircle2 className="h-4 w-4" />
          <AlertTitle>Currently Viewing as User</AlertTitle>
          <AlertDescription className="flex flex-col gap-2">
            <span>
              You are viewing the portal as <strong>{session.user.viewingAsUserName}</strong>
              {session.user.viewingAsUserEmail && <> ({session.user.viewingAsUserEmail})</>}
            </span>
            <Button
              variant="outline"
              size="sm"
              onClick={handleStopViewing}
              disabled={isStartingView}
              className="w-fit"
            >
              {isStartingView ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Stopping...
                </>
              ) : (
                <>
                  <X className="mr-2 h-4 w-4" />
                  Stop Viewing as User
                </>
              )}
            </Button>
          </AlertDescription>
        </Alert>
      )}

      <Card>
        <CardHeader>
          <CardTitle>Search Users</CardTitle>
          <CardDescription>
            Find a user by name or email address (minimum 2 characters)
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search by name or email..."
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              className="pl-9"
            />
          </div>

          {isSearching && (
            <div className="flex items-center gap-2 text-sm text-muted-foreground py-2">
              <Loader2 className="h-4 w-4 animate-spin" />
              Searching...
            </div>
          )}

          {!isSearching && query.length >= 2 && users.length === 0 && (
            <p className="text-sm text-muted-foreground py-2">
              No users found matching &ldquo;{query}&rdquo;
            </p>
          )}

          {users.length > 0 && (
            <div className="space-y-2">
              {users.map((user) => (
                <div
                  key={user.id}
                  className="flex items-center gap-3 p-3 rounded-lg border hover:bg-accent/50 transition-colors"
                >
                  <Avatar className="h-9 w-9">
                    <AvatarImage src={user.avatar || undefined} />
                    <AvatarFallback className="text-xs">{getInitials(user.name)}</AvatarFallback>
                  </Avatar>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="font-medium text-sm truncate">
                        {user.name || "Unnamed User"}
                      </span>
                      {user.isSuperAdmin && (
                        <Badge variant="destructive" className="text-[10px] px-1.5 py-0">
                          Super Admin
                        </Badge>
                      )}
                      {user.role && (
                        <Badge variant="outline" className="text-[10px] px-1.5 py-0">
                          {user.role}
                        </Badge>
                      )}
                    </div>
                    <p className="text-xs text-muted-foreground truncate">{user.email}</p>
                  </div>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => handleStartViewing(user)}
                    disabled={isStartingView}
                    className="shrink-0"
                  >
                    {isStartingView ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <>
                        <Eye className="h-4 w-4 mr-1" />
                        View as
                      </>
                    )}
                  </Button>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
