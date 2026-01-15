import { useState, useEffect } from "react";
import { Badge } from "./ui/badge";
import { Button } from "./ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "./ui/popover";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem } from "./ui/command";
import { Check, Plus, Tag as TagIcon, X } from "lucide-react";
import { cn } from "../lib/utils";
import { useAuth } from "../contexts/AuthContext";
import { toast } from "sonner";

interface Tag {
    id: number;
    name: string;
    color: string;
}

interface TagManagerProps {
    entityId: number | string;
    entityType: 'lead' | 'conversation';
    readOnly?: boolean;
    maxVisible?: number;
    onTagsChange?: (tags: Tag[]) => void;

    // New Props for Flexibilty
    variant?: 'default' | 'list' | 'trigger';
    tags?: Tag[]; // Controlled state support
    trigger?: React.ReactNode; // Custom trigger for 'trigger' variant
}

export function TagManager({
    entityId,
    entityType,
    readOnly = false,
    maxVisible = 3,
    onTagsChange,
    variant = 'default',
    tags,
    trigger
}: TagManagerProps) {
    const { token } = useAuth();
    const [allTags, setAllTags] = useState<Tag[]>([]);
    const [internalSelectedTags, setInternalSelectedTags] = useState<Tag[]>([]);
    const [isOpen, setIsOpen] = useState(false);
    const [isLoading, setIsLoading] = useState(false);

    // Use controlled tags if provided, otherwise internal state
    const selectedTags = tags || internalSelectedTags;

    // Initial Fetch
    useEffect(() => {
        if (!token) return;
        fetchAllTags();
        // Only fetch entity tags if not controlled (or if we want to sync internal state when controlled prop might be missing initially)
        if (!tags) {
            fetchEntityTags();
        }
    }, [token, entityId, entityType]);

    // Update internal state when controlled tags change (if we want to keep them in sync or just rely on prop)
    useEffect(() => {
        if (tags) {
            setInternalSelectedTags(tags);
        }
    }, [tags]);


    const fetchAllTags = async () => {
        try {
            const res = await fetch('/api/crm/tags', {
                headers: { 'Authorization': `Bearer ${token}` }
            });
            if (res.ok) setAllTags(await res.json());
        } catch (e) {
            console.error("Failed to fetch all tags", e);
        }
    };

    const fetchEntityTags = async () => {
        try {
            const url = entityType === 'lead'
                ? `/api/crm/leads/${entityId}/tags`
                : `/api/evolution/conversations/${entityId}/tags`;

            const res = await fetch(url, {
                headers: { 'Authorization': `Bearer ${token}` }
            });
            if (res.ok) {
                const data = await res.json();
                setInternalSelectedTags(data);
                if (onTagsChange) onTagsChange(data);
            }
        } catch (e) {
            console.error("Failed to fetch entity tags", e);
        }
    };

    const toggleTag = async (tag: Tag) => {
        const isSelected = selectedTags.some(t => t.id === tag.id);
        const method = isSelected ? 'DELETE' : 'POST';
        const url = entityType === 'lead'
            ? `/api/crm/leads/${entityId}/tags${isSelected ? `/${tag.id}` : ''}`
            : `/api/evolution/conversations/${entityId}/tags${isSelected ? `/${tag.id}` : ''}`;

        // Optimistic Update
        const prevTags = selectedTags;
        let newTags;
        if (isSelected) {
            newTags = prevTags.filter(t => t.id !== tag.id);
        } else {
            newTags = [...prevTags, tag];
        }

        // Update Internal
        setInternalSelectedTags(newTags);
        // Trigger Callback immediately for optimistic UI
        if (onTagsChange) onTagsChange(newTags);

        try {
            const res = await fetch(url, {
                method,
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`
                },
                body: !isSelected ? JSON.stringify({ tagId: tag.id }) : undefined
            });

            if (!res.ok) {
                throw new Error("Failed");
            }
            // If success, keep optimistic state. 
        } catch (e) {
            toast.error("Erro ao atualizar tag");
            // Rollback
            setInternalSelectedTags(prevTags);
            if (onTagsChange) onTagsChange(prevTags);
        }
    };

    if (variant === 'trigger') {
        return (
            <Popover open={isOpen} onOpenChange={setIsOpen}>
                <PopoverTrigger asChild>
                    {trigger || (
                        <Button variant="outline" size="sm">
                            Etiquetas
                        </Button>
                    )}
                </PopoverTrigger>
                <PopoverContent className="w-[200px] p-0" align="start">
                    <Command>
                        <CommandInput placeholder="Buscar tag..." className="h-8 text-xs" />
                        <CommandEmpty className="py-2 text-center text-xs">Nenhuma tag encontrada.</CommandEmpty>
                        <CommandGroup className="max-h-[200px] overflow-y-auto">
                            {allTags.map(tag => {
                                const isSelected = selectedTags.some(t => t.id === tag.id);
                                return (
                                    <CommandItem
                                        key={tag.id}
                                        onSelect={() => toggleTag(tag)}
                                        className="text-xs"
                                    >
                                        <div
                                            className="mr-2 h-2 w-2 rounded-full"
                                            style={{ backgroundColor: tag.color }}
                                        />
                                        {tag.name}
                                        {isSelected && <Check className="ml-auto h-3 w-3 opacity-100" />}
                                    </CommandItem>
                                );
                            })}
                        </CommandGroup>
                    </Command>
                </PopoverContent>
            </Popover>
        )
    }

    return (
        <div className="flex flex-wrap items-center gap-1.5" onClick={(e) => e.stopPropagation()}>
            {selectedTags.slice(0, maxVisible).map(tag => (
                <div
                    key={tag.id}
                    className="flex items-center gap-1 rounded-sm px-1.5 py-0.5 text-[10px] font-medium border transition-colors shadow-sm"
                    style={{
                        backgroundColor: tag.color ? `${tag.color}20` : '#cbd5e120',
                        borderColor: tag.color ? `${tag.color}60` : '#cbd5e160',
                        color: 'inherit'
                    }}
                >
                    <TagIcon className="h-3 w-3 opacity-70" />
                    <span className="truncate max-w-[80px]">{tag.name}</span>
                    {!readOnly && (
                        <button
                            onClick={(e) => { e.stopPropagation(); toggleTag(tag); }}
                            className="ml-0.5 rounded-full hover:bg-black/10 dark:hover:bg-white/10 p-0.5"
                        >
                            <X className="h-2 w-2" />
                        </button>
                    )}
                </div>
            ))}

            {selectedTags.length > maxVisible && (
                <div className="flex items-center justify-center rounded-sm bg-muted px-1.5 py-0.5 text-[10px] font-medium text-muted-foreground border border-muted-foreground/30">
                    +{selectedTags.length - maxVisible}
                </div>
            )}

            {!readOnly && variant === 'default' && (
                <Popover open={isOpen} onOpenChange={setIsOpen}>
                    <PopoverTrigger asChild>
                        <Button
                            variant="ghost"
                            size="icon"
                            className="h-5 w-5 rounded-full hover:bg-muted text-muted-foreground"
                            onClick={(e) => e.stopPropagation()} // Prevent card click
                        >
                            <Plus className="h-3 w-3" />
                        </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-[200px] p-0" align="start">
                        <Command>
                            <CommandInput placeholder="Buscar tag..." className="h-8 text-xs" />
                            <CommandEmpty className="py-2 text-center text-xs">Nenhuma tag encontrada.</CommandEmpty>
                            <CommandGroup className="max-h-[200px] overflow-y-auto">
                                {allTags.map(tag => {
                                    const isSelected = selectedTags.some(t => t.id === tag.id);
                                    return (
                                        <CommandItem
                                            key={tag.id}
                                            onSelect={() => toggleTag(tag)}
                                            className="text-xs"
                                        >
                                            <div
                                                className="mr-2 h-2 w-2 rounded-full"
                                                style={{ backgroundColor: tag.color }}
                                            />
                                            {tag.name}
                                            {isSelected && <Check className="ml-auto h-3 w-3 opacity-100" />}
                                        </CommandItem>
                                    );
                                })}
                            </CommandGroup>
                        </Command>
                    </PopoverContent>
                </Popover>
            )}
        </div>
    );
}
