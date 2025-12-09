"use client"

import { useParams } from "next/navigation"
import { athletes } from "@/mock-data/athletes"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Progress } from "@/components/ui/progress"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { attendanceHistory, medicalRecords } from "@/mock-data/athlete-details"
import { ShieldAlert, Phone as PhoneIcon, FileHeart, CalendarCheck, CalendarX } from "lucide-react"

export default function AthleteProfilePage() {
  const params = useParams()
  const athlete = athletes.find(a => a.id === params.id)
  
  // Only show detailed mock data for Sophia Miller for now, or fallback if needed
  const isSophia = athlete?.id === "ATH-001"
  const history = isSophia ? attendanceHistory : []
  const medical = isSophia ? medicalRecords : { conditions: [], allergies: [], emergencyContacts: [], insurance: { provider: "", policyNumber: "", groupNumber: "" }, lastPhysical: "" }

  if (!athlete) {
    return (
      <div className="flex flex-col items-center justify-center h-full p-6">
        <h1 className="text-2xl font-bold">Athlete Not Found</h1>
        <p className="text-muted-foreground">The athlete you are looking for does not exist.</p>
        <Button className="mt-4" variant="outline" onClick={() => window.history.back()}>Go Back</Button>
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-6 p-6">
      {/* Header Section */}
      <div className="flex flex-col gap-6 md:flex-row md:items-start md:justify-between">
        <div className="flex flex-col md:flex-row gap-6 items-start">
          <Avatar className="h-24 w-24 border-4 border-background shadow-sm">
            <AvatarImage src={athlete.avatar} alt={athlete.name} />
            <AvatarFallback>{athlete.name.split(" ").map(n => n[0]).join("")}</AvatarFallback>
          </Avatar>
          <div className="space-y-1">
            <h1 className="text-3xl font-bold tracking-tight">{athlete.name}</h1>
            <div className="flex items-center gap-2 text-muted-foreground">
              <Badge variant="secondary" className="rounded-md">{athlete.level}</Badge>
              <span>•</span>
              <span className="flex items-center gap-1"><User className="h-4 w-4" /> {athlete.group}</span>
            </div>
            <div className="flex items-center gap-4 text-sm text-muted-foreground pt-1">
              <span className="flex items-center gap-1"><Mail className="h-3 w-3" /> {athlete.email}</span>
              <span className="flex items-center gap-1"><User className="h-3 w-3" /> Parent: {athlete.parent}</span>
            </div>
          </div>
        </div>
        <div className="flex gap-2">
            <Button variant="outline">Edit Profile</Button>
            <Button>Contact</Button>
        </div>
      </div>

      {/* Stats Grid */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Attendance Rate</CardTitle>
            <CalendarDays className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">92%</div>
            <p className="text-xs text-muted-foreground">+2% from last month</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Skills Mastered</CardTitle>
            <Trophy className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">14</div>
            <p className="text-xs text-muted-foreground">3 new this month</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Current Level Progress</CardTitle>
            <TrendingUp className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">78%</div>
            <Progress value={78} className="mt-2 h-2" />
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Next Event</CardTitle>
            <Star className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">Regionals</div>
            <p className="text-xs text-muted-foreground">In 14 days</p>
          </CardContent>
        </Card>
      </div>

      {/* Main Content Tabs */}
      <Tabs defaultValue="performance" className="space-y-4">
        <TabsList>
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="performance">Performance</TabsTrigger>
          <TabsTrigger value="attendance">Attendance</TabsTrigger>
          <TabsTrigger value="medical">Medical</TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Recent Activity</CardTitle>
              <CardDescription>Latest updates for {athlete.name}</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                 <div className="flex items-center gap-4">
                   <div className="bg-primary/10 p-2 rounded-full"><Trophy className="h-4 w-4 text-primary" /></div>
                   <div>
                     <p className="font-medium">Mastered Full Turn on Beam</p>
                     <p className="text-sm text-muted-foreground">2 days ago</p>
                   </div>
                 </div>
                 <div className="flex items-center gap-4">
                   <div className="bg-primary/10 p-2 rounded-full"><CalendarDays className="h-4 w-4 text-primary" /></div>
                   <div>
                     <p className="font-medium">Attended Elite Squad Training</p>
                     <p className="text-sm text-muted-foreground">Yesterday</p>
                   </div>
                 </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="performance" className="space-y-4">
          <div className="grid gap-6 md:grid-cols-[250px_1fr]">
             <Card className="h-fit">
                <CardHeader>
                  <CardTitle>Level Status</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                   <div className="flex flex-col items-center justify-center py-4">
                      <div className="relative flex items-center justify-center h-32 w-32 rounded-full border-4 border-primary">
                        <span className="text-2xl font-bold">78%</span>
                      </div>
                      <p className="mt-4 font-medium">{athlete.level}</p>
                      <p className="text-sm text-muted-foreground">In Progress</p>
                   </div>
                   <div className="space-y-2">
                     <div className="flex justify-between text-sm">
                       <span>Vault</span>
                       <span className="font-bold">80%</span>
                     </div>
                     <Progress value={80} />
                   </div>
                   <div className="space-y-2">
                     <div className="flex justify-between text-sm">
                       <span>Bars</span>
                       <span className="font-bold">65%</span>
                     </div>
                     <Progress value={65} />
                   </div>
                   <div className="space-y-2">
                     <div className="flex justify-between text-sm">
                       <span>Beam</span>
                       <span className="font-bold">90%</span>
                     </div>
                     <Progress value={90} />
                   </div>
                   <div className="space-y-2">
                     <div className="flex justify-between text-sm">
                       <span>Floor</span>
                       <span className="font-bold">75%</span>
                     </div>
                     <Progress value={75} />
                   </div>
                </CardContent>
             </Card>

             <div className="flex-1">
              <Tabs defaultValue="beam" className="w-full">
                <TabsList className="grid w-full grid-cols-4">
                  <TabsTrigger value="vault">Vault</TabsTrigger>
                  <TabsTrigger value="bars">Uneven Bars</TabsTrigger>
                  <TabsTrigger value="beam">Balance Beam</TabsTrigger>
                  <TabsTrigger value="floor">Floor Exercise</TabsTrigger>
                </TabsList>
                
                <TabsContent value="beam" className="space-y-4 mt-4">
                  <Card>
                    <CardHeader>
                      <CardTitle>Balance Beam Skills</CardTitle>
                      <CardDescription>{athlete.level} Requirements</CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-6">
                      <div className="space-y-2">
                        <div className="flex justify-between items-center">
                          <span className="font-medium">Switch Split Leap</span>
                          <span className="text-sm text-muted-foreground">Mastered</span>
                        </div>
                        <Progress value={100} className="bg-secondary" />
                      </div>
                      
                      <div className="space-y-2">
                        <div className="flex justify-between items-center">
                          <span className="font-medium">Back Handspring Series</span>
                          <span className="text-sm text-muted-foreground">In Progress</span>
                        </div>
                        <Progress value={65} className="bg-secondary" />
                      </div>

                      <div className="space-y-2">
                        <div className="flex justify-between items-center">
                          <span className="font-medium">Full Turn</span>
                          <span className="text-sm text-muted-foreground">Mastered</span>
                        </div>
                        <Progress value={100} className="bg-secondary" />
                      </div>

                      <div className="space-y-2">
                        <div className="flex justify-between items-center">
                          <span className="font-medium">Aerial Cartwheel</span>
                          <span className="text-sm text-muted-foreground">Learning</span>
                        </div>
                        <Progress value={30} className="bg-secondary" />
                      </div>
                    </CardContent>
                  </Card>
                </TabsContent>

                <TabsContent value="floor" className="space-y-4 mt-4">
                  <Card>
                    <CardHeader>
                      <CardTitle>Floor Exercise Skills</CardTitle>
                      <CardDescription>{athlete.level} Requirements</CardDescription>
                    </CardHeader>
                    <CardContent>
                      <p className="text-muted-foreground">Select Balance Beam tab to see example data.</p>
                    </CardContent>
                  </Card>
                </TabsContent>
                
                <TabsContent value="vault" className="mt-4"><Card><CardContent className="pt-6">Vault skills tracking...</CardContent></Card></TabsContent>
                <TabsContent value="bars" className="mt-4"><Card><CardContent className="pt-6">Bars skills tracking...</CardContent></Card></TabsContent>
              </Tabs>
             </div>
          </div>
        </TabsContent>

        <TabsContent value="attendance" className="space-y-4">
           <Card>
             <CardHeader>
               <CardTitle>Attendance History</CardTitle>
               <CardDescription>Recent class attendance records</CardDescription>
             </CardHeader>
             <CardContent>
               {history.length > 0 ? (
                 <div className="space-y-4">
                   {history.map((record) => (
                     <div key={record.id} className="flex items-center justify-between border-b pb-4 last:border-0 last:pb-0">
                       <div className="flex items-center gap-4">
                         <div className={`p-2 rounded-full ${record.status === 'Present' ? 'bg-green-100' : 'bg-red-100'}`}>
                           {record.status === 'Present' ? (
                             <CalendarCheck className={`h-4 w-4 ${record.status === 'Present' ? 'text-green-600' : 'text-red-600'}`} />
                           ) : (
                             <CalendarX className="h-4 w-4 text-red-600" />
                           )}
                         </div>
                         <div>
                           <p className="font-medium">{record.class}</p>
                           <p className="text-sm text-muted-foreground">{record.date} • {record.time}</p>
                         </div>
                       </div>
                       <Badge variant={record.status === 'Present' ? 'default' : 'destructive'}>
                         {record.status}
                       </Badge>
                     </div>
                   ))}
                 </div>
               ) : (
                 <p className="text-muted-foreground text-center py-4">No attendance records found.</p>
               )}
             </CardContent>
           </Card>
        </TabsContent>
        
        <TabsContent value="medical" className="space-y-4">
           <div className="grid gap-4 md:grid-cols-2">
             <Card>
               <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                 <CardTitle className="text-base font-medium">Emergency Contacts</CardTitle>
                 <PhoneIcon className="h-4 w-4 text-muted-foreground" />
               </CardHeader>
               <CardContent className="pt-4">
                 {medical.emergencyContacts.length > 0 ? (
                   <div className="space-y-4">
                     {medical.emergencyContacts.map((contact, index) => (
                       <div key={index} className="flex justify-between items-center">
                         <div>
                           <p className="font-medium">{contact.name}</p>
                           <p className="text-sm text-muted-foreground">{contact.relation}</p>
                         </div>
                         <div className="text-right">
                           <p className="font-medium">{contact.phone}</p>
                         </div>
                       </div>
                     ))}
                   </div>
                 ) : (
                   <p className="text-sm text-muted-foreground">No contacts listed.</p>
                 )}
               </CardContent>
             </Card>

             <Card>
               <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                 <CardTitle className="text-base font-medium">Medical Alerts</CardTitle>
                 <ShieldAlert className="h-4 w-4 text-muted-foreground" />
               </CardHeader>
               <CardContent className="pt-4 space-y-4">
                 <div>
                   <span className="text-sm font-medium text-muted-foreground mb-1 block">Conditions</span>
                   {medical.conditions.length > 0 ? (
                     <div className="flex flex-wrap gap-2">
                       {medical.conditions.map((c, i) => <Badge key={i} variant="outline">{c}</Badge>)}
                     </div>
                   ) : <span className="text-sm">None</span>}
                 </div>
                 <div>
                   <span className="text-sm font-medium text-muted-foreground mb-1 block">Allergies</span>
                   {medical.allergies.length > 0 ? (
                     <div className="flex flex-wrap gap-2">
                       {medical.allergies.map((a, i) => <Badge key={i} variant="destructive" className="bg-red-100 text-red-800 hover:bg-red-100 border-red-200">{a}</Badge>)}
                     </div>
                   ) : <span className="text-sm">None</span>}
                 </div>
               </CardContent>
             </Card>

             <Card className="md:col-span-2">
               <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                 <CardTitle className="text-base font-medium">Insurance & Records</CardTitle>
                 <FileHeart className="h-4 w-4 text-muted-foreground" />
               </CardHeader>
               <CardContent className="pt-4">
                 <div className="grid md:grid-cols-2 gap-6">
                   <div>
                     <h4 className="font-medium mb-2 text-sm">Insurance Information</h4>
                     <dl className="space-y-1 text-sm">
                       <div className="flex justify-between"><dt className="text-muted-foreground">Provider:</dt><dd>{medical.insurance.provider || "N/A"}</dd></div>
                       <div className="flex justify-between"><dt className="text-muted-foreground">Policy #:</dt><dd>{medical.insurance.policyNumber || "N/A"}</dd></div>
                       <div className="flex justify-between"><dt className="text-muted-foreground">Group #:</dt><dd>{medical.insurance.groupNumber || "N/A"}</dd></div>
                     </dl>
                   </div>
                   <div>
                     <h4 className="font-medium mb-2 text-sm">Last Physical Exam</h4>
                     <p className="text-2xl font-bold">{medical.lastPhysical || "N/A"}</p>
                     <p className="text-xs text-muted-foreground text-green-600 flex items-center mt-1">
                       <CalendarCheck className="h-3 w-3 mr-1" /> Valid until Aug 2024
                     </p>
                   </div>
                 </div>
               </CardContent>
             </Card>
           </div>
        </TabsContent>

      </Tabs>
    </div>
  )
}

