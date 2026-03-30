"use client";

import * as React from "react";
import { useParams } from "next/navigation";
import {
  ArrowLeft,
  Mail,
  Phone,
  MapPin,
  CreditCard,
  Download,
  FileText,
  User,
  Loader2,
  Star,
} from "lucide-react";
import Link from "next/link";

import { formatPhoneNumberIntl } from "react-phone-number-input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsTrigger } from "@/components/ui/tabs";
import { ResponsiveTabsList } from "@/components/ui/responsive-tabs";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { useBreadcrumbOverride } from "@/components/breadcrumb-context";

interface GuardianAthlete {
  id: string;
  name: string;
  firstName?: string | null;
  lastName?: string | null;
  birthDate?: string | null;
  gender?: string | null;
  level?: string | null;
  avatar?: string | null;
  status: string;
  isPrimary?: boolean;
  relationship?: string | null;
}

interface Contact {
  id: string;
  firstName: string;
  lastName: string;
  email?: string | null;
  phone?: string | null;
  isPrimary?: boolean;
  relationship?: string | null;
}

interface BillingAddress {
  id: string;
  label?: string | null;
  street: string;
  city: string;
  stateProvince?: string | null;
  postalCode?: string | null;
  country?: string | null;
  isPrimary?: boolean;
}

interface Invoice {
  id: string;
  reference?: string | null;
  total: number | string;
  status: string;
  createdAt: string;
}

interface Payment {
  id: string;
  amount: number | string;
  method?: string | null;
  status: string;
  processedAt?: string | null;
}

interface GuardianDetail {
  id: string;
  name: string | null;
  email: string | null;
  phone: string | null;
  balance: number | string | null;
  status: string | null;
  athletes: GuardianAthlete[];
  contacts: Contact[];
  billingAddresses: BillingAddress[];
  userInvoices: Invoice[];
  userPayments: Payment[];
}

export default function GuardianDetailPage() {
  const params = useParams();
  const guardianId = typeof params.id === "string" ? params.id : null;
  const [activeTab, setActiveTab] = React.useState("overview");
  const [guardian, setGuardian] = React.useState<GuardianDetail | null>(null);
  const [isLoading, setIsLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);

  useBreadcrumbOverride(
    guardian ? `/dashboard/athletes/guardians/${guardianId}` : undefined,
    guardian?.name ?? undefined
  );

  React.useEffect(() => {
    if (!guardianId) return;
    setIsLoading(true);
    fetch(`/api/guardians/${guardianId}`)
      .then(async (res) => {
        if (!res.ok) throw new Error("Guardian not found");
        return res.json();
      })
      .then((data) => {
        setGuardian(data);
        setError(null);
      })
      .catch((err) => {
        setError(err instanceof Error ? err.message : "Failed to load guardian");
      })
      .finally(() => setIsLoading(false));
  }, [guardianId]);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-[50vh] gap-2">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        <p className="text-muted-foreground">Loading guardian details...</p>
      </div>
    );
  }

  if (error || !guardian) {
    return (
      <div className="flex flex-col items-center justify-center h-[50vh] gap-4">
        <h1 className="text-2xl font-bold">{error || "Guardian Not Found"}</h1>
        <Button asChild>
          <Link href="/dashboard/athletes/guardians">Go Back</Link>
        </Button>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-6 p-6">
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="icon" asChild>
          <Link href="/dashboard/athletes/guardians">
            <ArrowLeft className="h-4 w-4" />
          </Link>
        </Button>
        <div className="flex-1">
          <h1 className="text-3xl font-bold tracking-tight">{guardian.name || "Guardian"}</h1>
          <div className="flex items-center gap-2 text-muted-foreground">
            <span className="flex items-center gap-1">
              <User className="h-4 w-4" /> {guardian.email}
            </span>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline">Statement</Button>
        </div>
      </div>

      <div className="grid gap-6 md:grid-cols-3">
        {/* Sidebar Info */}
        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Contact Information</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-muted rounded-full">
                  <Mail className="h-4 w-4 text-muted-foreground" />
                </div>
                <div className="overflow-hidden">
                  <p className="text-sm font-medium">Email</p>
                  <p
                    className="text-sm text-muted-foreground truncate"
                    title={guardian.email || undefined}
                  >
                    {guardian.email || "—"}
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-3">
                <div className="p-2 bg-muted rounded-full">
                  <Phone className="h-4 w-4 text-muted-foreground" />
                </div>
                <div>
                  <p className="text-sm font-medium">Phone</p>
                  <p className="text-sm text-muted-foreground">
                    {guardian.phone ? formatPhoneNumberIntl(guardian.phone) || guardian.phone : "—"}
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Account Summary</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <p className="text-sm font-medium text-muted-foreground">Current Balance</p>
                <p
                  className={`text-2xl font-bold ${Number(guardian.balance) > 0 ? "text-destructive" : "text-green-600"}`}
                >
                  ${Math.abs(Number(guardian.balance || 0)).toFixed(2)}
                  {Number(guardian.balance) < 0 ? " CR" : ""}
                </p>
              </div>
              <div className="pt-2 border-t">
                <p className="text-sm font-medium text-muted-foreground">Status</p>
                <Badge
                  variant={guardian.status === "ACTIVE" ? "default" : "secondary"}
                  className="mt-1"
                >
                  {guardian.status
                    ? guardian.status.charAt(0) + guardian.status.slice(1).toLowerCase()
                    : "Unknown"}
                </Badge>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Main Content */}
        <div className="md:col-span-2">
          <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
            <ResponsiveTabsList
              value={activeTab}
              onValueChange={setActiveTab}
              className="w-full justify-start"
            >
              <TabsTrigger value="overview">Overview</TabsTrigger>
              <TabsTrigger value="athletes">Athletes</TabsTrigger>
              <TabsTrigger value="contacts">Contacts</TabsTrigger>
              <TabsTrigger value="billing">Billing</TabsTrigger>
            </ResponsiveTabsList>

            {/* Overview Tab */}
            <TabsContent value="overview" className="mt-6 space-y-4">
              <Card>
                <CardHeader>
                  <CardTitle>Profile Information</CardTitle>
                </CardHeader>
                <CardContent>
                  <dl className="grid gap-4 sm:grid-cols-2">
                    <div>
                      <dt className="text-sm font-medium text-muted-foreground">Name</dt>
                      <dd className="text-sm mt-1">{guardian.name || "—"}</dd>
                    </div>
                    <div>
                      <dt className="text-sm font-medium text-muted-foreground">Email</dt>
                      <dd className="text-sm mt-1">{guardian.email || "—"}</dd>
                    </div>
                    <div>
                      <dt className="text-sm font-medium text-muted-foreground">Phone</dt>
                      <dd className="text-sm mt-1">
                        {guardian.phone
                          ? formatPhoneNumberIntl(guardian.phone) || guardian.phone
                          : "—"}
                      </dd>
                    </div>
                    <div>
                      <dt className="text-sm font-medium text-muted-foreground">Status</dt>
                      <dd className="text-sm mt-1">
                        <Badge variant={guardian.status === "ACTIVE" ? "default" : "secondary"}>
                          {guardian.status
                            ? guardian.status.charAt(0) + guardian.status.slice(1).toLowerCase()
                            : "Unknown"}
                        </Badge>
                      </dd>
                    </div>
                    <div>
                      <dt className="text-sm font-medium text-muted-foreground">Athletes</dt>
                      <dd className="text-sm mt-1">{guardian.athletes.length} linked</dd>
                    </div>
                    <div>
                      <dt className="text-sm font-medium text-muted-foreground">Balance</dt>
                      <dd className="text-sm mt-1">
                        <Badge
                          variant={
                            Number(guardian.balance) > 0
                              ? "destructive"
                              : Number(guardian.balance) < 0
                                ? "secondary"
                                : "outline"
                          }
                          className={
                            Number(guardian.balance) < 0
                              ? "text-green-600 border-green-200 bg-green-50"
                              : ""
                          }
                        >
                          ${Math.abs(Number(guardian.balance || 0)).toFixed(2)}
                          {Number(guardian.balance) < 0 ? " CR" : ""}
                        </Badge>
                      </dd>
                    </div>
                  </dl>
                </CardContent>
              </Card>
            </TabsContent>

            {/* Athletes Tab */}
            <TabsContent value="athletes" className="mt-6 space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="text-lg font-medium">Linked Athletes</h3>
              </div>
              <div className="grid gap-4 sm:grid-cols-2">
                {guardian.athletes.map((athlete) => (
                  <Card key={athlete.id} className="overflow-hidden">
                    <CardContent className="p-0">
                      <div className="flex items-center gap-4 p-4">
                        <Avatar className="h-12 w-12">
                          <AvatarImage src={athlete.avatar || undefined} alt={athlete.name} />
                          <AvatarFallback>{(athlete.name || "?").charAt(0)}</AvatarFallback>
                        </Avatar>
                        <div className="flex-1 min-w-0">
                          <Link
                            href={`/dashboard/athletes/${athlete.id}`}
                            className="hover:underline"
                          >
                            <h4 className="font-semibold truncate">{athlete.name}</h4>
                          </Link>
                          <p className="text-sm text-muted-foreground">
                            {athlete.level || "No level"}
                          </p>
                        </div>
                        <Badge variant={athlete.status === "ACTIVE" ? "default" : "secondary"}>
                          {athlete.status.charAt(0) + athlete.status.slice(1).toLowerCase()}
                        </Badge>
                      </div>
                      <div className="bg-muted/50 px-4 py-3 flex items-center justify-between text-sm">
                        <span className="text-muted-foreground">
                          {athlete.relationship || "Guardian"}
                          {athlete.isPrimary && " · Primary"}
                        </span>
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-auto p-0 text-primary"
                          asChild
                        >
                          <Link href={`/dashboard/athletes/${athlete.id}`}>View</Link>
                        </Button>
                      </div>
                    </CardContent>
                  </Card>
                ))}
                {guardian.athletes.length === 0 && (
                  <div className="col-span-2 text-center p-8 border rounded-lg border-dashed text-muted-foreground">
                    No athletes linked to this guardian.
                  </div>
                )}
              </div>
            </TabsContent>

            {/* Contacts Tab */}
            <TabsContent value="contacts" className="mt-6 space-y-6">
              <Card>
                <CardHeader>
                  <CardTitle>Contacts</CardTitle>
                  <CardDescription>Contact records associated with this guardian.</CardDescription>
                </CardHeader>
                <CardContent>
                  {guardian.contacts && guardian.contacts.length > 0 ? (
                    <div className="space-y-3">
                      {guardian.contacts.map((contact) => (
                        <div
                          key={contact.id}
                          className="flex items-center gap-4 p-3 border rounded-lg"
                        >
                          <div className="p-2 bg-muted rounded-full">
                            <User className="h-4 w-4 text-muted-foreground" />
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2">
                              <p className="text-sm font-medium">
                                {contact.firstName} {contact.lastName}
                              </p>
                              {contact.isPrimary && (
                                <Badge variant="secondary" className="text-[10px] h-5">
                                  <Star className="h-3 w-3 mr-0.5" />
                                  Primary
                                </Badge>
                              )}
                              {contact.relationship && (
                                <Badge variant="outline" className="text-[10px] h-5">
                                  {contact.relationship}
                                </Badge>
                              )}
                            </div>
                            <p className="text-sm text-muted-foreground">
                              {contact.email || "—"} &middot;{" "}
                              {contact.phone
                                ? formatPhoneNumberIntl(contact.phone) || contact.phone
                                : "—"}
                            </p>
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="text-sm text-muted-foreground text-center py-4">
                      No contacts saved.
                    </p>
                  )}
                </CardContent>
              </Card>
            </TabsContent>

            {/* Billing Tab */}
            <TabsContent value="billing" className="mt-6 space-y-6">
              {/* Billing Addresses */}
              <Card>
                <CardHeader>
                  <CardTitle>Billing Addresses</CardTitle>
                  <CardDescription>Addresses used during checkout.</CardDescription>
                </CardHeader>
                <CardContent>
                  {guardian.billingAddresses && guardian.billingAddresses.length > 0 ? (
                    <div className="space-y-3">
                      {guardian.billingAddresses.map((addr) => (
                        <div
                          key={addr.id}
                          className="flex items-center gap-4 p-3 border rounded-lg"
                        >
                          <div className="p-2 bg-muted rounded-full">
                            <MapPin className="h-4 w-4 text-muted-foreground" />
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2">
                              <p className="text-sm font-medium">
                                {addr.label || "Billing Address"}
                              </p>
                              {addr.isPrimary && (
                                <Badge variant="secondary" className="text-[10px] h-5">
                                  <Star className="h-3 w-3 mr-0.5" />
                                  Primary
                                </Badge>
                              )}
                            </div>
                            <p className="text-sm text-muted-foreground">
                              {addr.street}, {addr.city}
                              {addr.stateProvince ? `, ${addr.stateProvince}` : ""}{" "}
                              {addr.postalCode}
                              {addr.country ? ` ${addr.country}` : ""}
                            </p>
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="text-sm text-muted-foreground text-center py-4">
                      No billing addresses saved.
                    </p>
                  )}
                </CardContent>
              </Card>

              {/* Invoice History */}
              <Card>
                <CardHeader className="flex flex-row items-center justify-between">
                  <CardTitle>Invoice History</CardTitle>
                  <Button variant="outline" size="sm">
                    <Download className="mr-2 h-4 w-4" /> Export
                  </Button>
                </CardHeader>
                <CardContent>
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Date</TableHead>
                        <TableHead>Reference</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead className="text-right">Amount</TableHead>
                        <TableHead className="text-right"></TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {guardian.userInvoices &&
                        guardian.userInvoices.map((inv) => (
                          <TableRow key={inv.id}>
                            <TableCell>{new Date(inv.createdAt).toLocaleDateString()}</TableCell>
                            <TableCell>{inv.reference || "—"}</TableCell>
                            <TableCell>
                              <Badge
                                variant="outline"
                                className={`capitalize ${
                                  inv.status === "PAID"
                                    ? "bg-green-50 text-green-700 border-green-200"
                                    : inv.status === "OVERDUE"
                                      ? "bg-red-50 text-red-700 border-red-200"
                                      : inv.status === "SENT"
                                        ? "bg-blue-50 text-blue-700 border-blue-200"
                                        : ""
                                }`}
                              >
                                {inv.status.toLowerCase()}
                              </Badge>
                            </TableCell>
                            <TableCell className="text-right">
                              ${Number(inv.total).toFixed(2)}
                            </TableCell>
                            <TableCell className="text-right">
                              <Button variant="ghost" size="icon">
                                <FileText className="h-4 w-4 text-muted-foreground" />
                              </Button>
                            </TableCell>
                          </TableRow>
                        ))}
                      {(!guardian.userInvoices || guardian.userInvoices.length === 0) && (
                        <TableRow>
                          <TableCell colSpan={5} className="h-24 text-center">
                            No invoices found.
                          </TableCell>
                        </TableRow>
                      )}
                    </TableBody>
                  </Table>
                </CardContent>
              </Card>

              {/* Payment History */}
              <Card>
                <CardHeader>
                  <CardTitle>Payment History</CardTitle>
                </CardHeader>
                <CardContent>
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Date</TableHead>
                        <TableHead>Method</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead className="text-right">Amount</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {guardian.userPayments &&
                        guardian.userPayments.map((pmt) => (
                          <TableRow key={pmt.id}>
                            <TableCell>
                              {pmt.processedAt
                                ? new Date(pmt.processedAt).toLocaleDateString()
                                : "—"}
                            </TableCell>
                            <TableCell>
                              <div className="flex items-center gap-1">
                                <CreditCard className="h-3 w-3 text-muted-foreground" />
                                {pmt.method || "—"}
                              </div>
                            </TableCell>
                            <TableCell>
                              <Badge
                                variant="outline"
                                className={`capitalize ${
                                  pmt.status === "COMPLETED"
                                    ? "bg-green-50 text-green-700 border-green-200"
                                    : pmt.status === "FAILED"
                                      ? "bg-red-50 text-red-700 border-red-200"
                                      : pmt.status === "PENDING"
                                        ? "bg-yellow-50 text-yellow-700 border-yellow-200"
                                        : ""
                                }`}
                              >
                                {pmt.status.toLowerCase()}
                              </Badge>
                            </TableCell>
                            <TableCell className="text-right">
                              ${Number(pmt.amount).toFixed(2)}
                            </TableCell>
                          </TableRow>
                        ))}
                      {(!guardian.userPayments || guardian.userPayments.length === 0) && (
                        <TableRow>
                          <TableCell colSpan={4} className="h-24 text-center">
                            No payments found.
                          </TableCell>
                        </TableRow>
                      )}
                    </TableBody>
                  </Table>
                </CardContent>
              </Card>
            </TabsContent>
          </Tabs>
        </div>
      </div>
    </div>
  );
}
