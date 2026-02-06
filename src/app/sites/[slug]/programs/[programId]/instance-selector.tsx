"use client";

import { useState, useEffect } from "react";
import { format } from "date-fns";
import { useCart } from "@/components/sites/cart-context";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Calendar, Clock, MapPin, ShoppingCart } from "lucide-react";

interface Instance {
    id: string;
    date: string;
    startTime: string;
    endTime: string;
    capacity?: number;
    registrationCount: number;
    facility?: { name: string; city?: string | null };
}

interface ProgramInstanceSelectorProps {
    instances: Instance[];
    program: {
        id: string;
        name: string;
        perSessionPrice?: number;
    };
    subdomain: string;
    /** If provided, this instance will be pre-selected */
    highlightInstanceId?: string | null;
}

export function ProgramInstanceSelector({ 
    instances, 
    program,
    subdomain,
    highlightInstanceId,
}: ProgramInstanceSelectorProps) {
    const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
    const { addItem, setIsOpen } = useCart();

    // Pre-select the highlighted instance on mount
    useEffect(() => {
        if (highlightInstanceId) {
            const instance = instances.find(i => i.id === highlightInstanceId);
            if (instance) {
                const isFull = instance.capacity !== undefined && instance.registrationCount >= instance.capacity;
                if (!isFull) {
                    setSelectedIds(new Set([highlightInstanceId]));
                }
            }
        }
    }, [highlightInstanceId, instances]);

    const toggleInstance = (id: string) => {
        const newSelected = new Set(selectedIds);
        if (newSelected.has(id)) {
            newSelected.delete(id);
        } else {
            newSelected.add(id);
        }
        setSelectedIds(newSelected);
    };

    const selectAll = () => {
        const availableIds = instances
            .filter(i => !i.capacity || i.registrationCount < i.capacity)
            .map(i => i.id);
        setSelectedIds(new Set(availableIds));
    };

    const clearSelection = () => {
        setSelectedIds(new Set());
    };

    const addToCart = () => {
        const selectedInstances = instances.filter(i => selectedIds.has(i.id));
        
        selectedInstances.forEach(instance => {
            addItem({
                referenceId: instance.id,
                type: "program-instance",
                name: `${program.name} - ${format(new Date(instance.date), "MMM d, yyyy")}`,
                description: `${instance.startTime} - ${instance.endTime}`,
                price: program.perSessionPrice || 0,
                quantity: 1,
                details: {
                    programId: program.id,
                    instanceId: instance.id,
                    date: instance.date,
                    startTime: instance.startTime,
                    endTime: instance.endTime,
                }
            });
        });

        // Open the cart sheet instead of navigating away
        setIsOpen(true);
    };

    const totalPrice = selectedIds.size * (program.perSessionPrice || 0);

    return (
        <div className="space-y-4">
            {/* Selection Controls */}
            <div className="flex items-center justify-between pb-3 border-b border-border">
                <div className="flex items-center gap-3">
                    <Button 
                        variant="outline" 
                        size="sm" 
                        onClick={selectAll}
                        disabled={instances.length === 0}
                    >
                        Select All
                    </Button>
                    <Button 
                        variant="ghost" 
                        size="sm" 
                        onClick={clearSelection}
                        disabled={selectedIds.size === 0}
                    >
                        Clear
                    </Button>
                </div>
                <div className="text-sm text-muted-foreground">
                    {selectedIds.size} of {instances.length} selected
                </div>
            </div>

            {/* Instance List */}
            <div className="divide-y divide-border max-h-[400px] overflow-y-auto">
                {instances.map((instance) => {
                    const isFull = instance.capacity !== undefined && instance.registrationCount >= instance.capacity;
                    const isSelected = selectedIds.has(instance.id);
                    const spotsLeft = instance.capacity ? instance.capacity - instance.registrationCount : null;

                    return (
                        <div 
                            key={instance.id}
                            className={`flex items-center gap-4 py-3 px-2 rounded transition-colors ${
                                isSelected ? 'bg-primary/5' : 'hover:bg-muted/50'
                            } ${isFull ? 'opacity-50' : 'cursor-pointer'}`}
                            onClick={() => !isFull && toggleInstance(instance.id)}
                        >
                            <Checkbox 
                                checked={isSelected}
                                disabled={isFull}
                                onCheckedChange={() => !isFull && toggleInstance(instance.id)}
                                className="shrink-0"
                            />
                            
                            <div className="flex-1 min-w-0">
                                <div className="flex items-center gap-2">
                                    <Calendar className="h-4 w-4 text-muted-foreground" />
                                    <span className="font-medium text-foreground">
                                        {format(new Date(instance.date), "EEE, MMM d")}
                                    </span>
                                </div>
                                <div className="flex items-center gap-4 mt-1 text-sm text-muted-foreground">
                                    <div className="flex items-center gap-1">
                                        <Clock className="h-3.5 w-3.5" />
                                        {instance.startTime} - {instance.endTime}
                                    </div>
                                    {instance.facility && (
                                        <div className="flex items-center gap-1">
                                            <MapPin className="h-3.5 w-3.5" />
                                            {instance.facility.name}
                                        </div>
                                    )}
                                </div>
                            </div>

                            <div className="text-right shrink-0">
                                {program.perSessionPrice && (
                                    <div className="font-medium text-foreground">
                                        ${program.perSessionPrice}
                                    </div>
                                )}
                                {spotsLeft !== null && (
                                    <div className={`text-xs ${
                                        isFull ? 'text-red-600 dark:text-red-400' : spotsLeft <= 3 ? 'text-orange-600 dark:text-orange-400' : 'text-green-600 dark:text-green-400'
                                    }`}>
                                        {isFull ? 'Full' : `${spotsLeft} spots`}
                                    </div>
                                )}
                            </div>
                        </div>
                    );
                })}
            </div>

            {/* Add to Cart Footer */}
            {selectedIds.size > 0 && (
                <div className="sticky bottom-0 bg-card pt-4 border-t border-border mt-4">
                    <div className="flex items-center justify-between">
                        <div>
                            <div className="text-sm text-muted-foreground">
                                {selectedIds.size} session{selectedIds.size !== 1 ? 's' : ''} selected
                            </div>
                            {program.perSessionPrice && (
                                <div className="text-xl font-bold text-foreground">
                                    ${totalPrice.toFixed(2)}
                                </div>
                            )}
                        </div>
                        <Button 
                            onClick={addToCart}
                            className="gap-2"
                            size="lg"
                        >
                            <ShoppingCart className="h-5 w-5" />
                            Add to Cart
                        </Button>
                    </div>
                </div>
            )}

            {instances.length === 0 && (
                <div className="text-center py-8 text-muted-foreground">
                    No upcoming sessions available for this program.
                </div>
            )}
        </div>
    );
}
