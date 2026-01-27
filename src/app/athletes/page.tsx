import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { CalendarDays, CreditCard, User } from "lucide-react";

export default function AthleteDashboard() {
  return (
    <div className="space-y-6">
       <section>
         <h2 className="text-xl font-bold mb-4">Welcome back!</h2>
         
         {/* Alerts */}
         <div className="bg-yellow-50 border border-yellow-200 text-yellow-800 p-4 rounded-lg mb-6 flex items-start gap-3">
             <CreditCard className="w-5 h-5 shrink-0 mt-0.5" />
             <div>
                 <p className="font-semibold">Invoice Due</p>
                 <p className="text-sm">You have an outstanding invoice of $150.00 due today.</p>
                 <Button variant="link" className="p-0 h-auto text-yellow-800 font-bold underline">Pay Now</Button>
             </div>
         </div>

         <div className="grid gap-4 md:grid-cols-2">
            <Card>
                <CardHeader className="pb-2">
                    <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                        <CalendarDays className="w-4 h-4" /> Next Class
                    </CardTitle>
                </CardHeader>
                <CardContent>
                    <div className="flex justify-between items-center mb-2">
                        <div className="font-bold text-lg">Tomorrow, 4:00 PM</div>
                        <span className="bg-slate-100 text-slate-800 text-xs px-2 py-1 rounded">Gym B</span>
                    </div>
                    <div className="font-medium">Level 2 Girls</div>
                    <div className="text-sm text-muted-foreground mt-1 flex items-center gap-2">
                        <User className="w-3 h-3" /> Sarah Smith
                    </div>
                </CardContent>
            </Card>
            
            <Card>
                <CardHeader className="pb-2">
                    <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                         <CalendarDays className="w-4 h-4" /> Upcoming Event
                    </CardTitle>
                </CardHeader>
                <CardContent>
                    <div className="flex justify-between items-center mb-2">
                        <div className="font-bold text-lg">Sat, Jun 15</div>
                        <span className="bg-blue-100 text-blue-800 text-xs px-2 py-1 rounded">Competition</span>
                    </div>
                    <div className="font-medium">Spring Showcase</div>
                    <Button size="sm" variant="outline" className="mt-2 w-full">View Details</Button>
                </CardContent>
            </Card>
         </div>
       </section>

       <section>
           <h3 className="font-semibold text-lg mb-3">My Family</h3>
           <div className="grid gap-4 grid-cols-2 md:grid-cols-4">
               <div className="bg-white p-4 rounded-lg border text-center space-y-2">
                   <div className="w-16 h-16 bg-slate-100 rounded-full mx-auto flex items-center justify-center text-xl font-bold">S</div>
                   <div className="font-medium">Sarah</div>
                   <div className="text-xs text-muted-foreground">Level 2</div>
               </div>
               <div className="bg-white p-4 rounded-lg border text-center space-y-2">
                   <div className="w-16 h-16 bg-slate-100 rounded-full mx-auto flex items-center justify-center text-xl font-bold">J</div>
                   <div className="font-medium">Jack</div>
                   <div className="text-xs text-muted-foreground">Kinder Gym</div>
               </div>
               <Button variant="ghost" className="h-full border border-dashed border-slate-300 rounded-lg flex flex-col gap-2 text-muted-foreground hover:text-primary hover:border-primary hover:bg-slate-50">
                   <div className="text-2xl">+</div>
                   <span>Add Athlete</span>
               </Button>
           </div>
       </section>
    </div>
  )
}
