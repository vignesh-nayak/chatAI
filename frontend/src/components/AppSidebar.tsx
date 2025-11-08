import { Search, MessageSquare, MessageSquarePlus } from "lucide-react";

import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
} from "@/components/ui/sidebar";
import { Link, NavLink, useNavigate } from "react-router-dom";
import { Button } from "./ui/button";
import { useEffect, useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { getRecentChats, searchChats, type SearchChatResult } from "@/lib/api";
import { cn } from "@/lib/utils";
import TypingLoader from "./TypingLoader";
import { Input } from "./ui/input";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "./ui/dialog";

type ChatStatus = "active" | "ended";

interface IChat {
  id: string;
  title: string;
  status?: ChatStatus;
  created_at?: string;
}

export function AppSidebar() {
  const [recentChats, setRecentChats] = useState<IChat[]>([]);
  const [isSearchOpen, setIsSearchOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const [lastQuery, setLastQuery] = useState("");
  const navigate = useNavigate();

  const { data: toDaysData } = useQuery({
    queryKey: ["todaysChat"],
    queryFn: getRecentChats,
  });

  const {
    data: searchResults,
    mutate: triggerSearch,
    isPending: isSearching,
    error: searchError,
    reset: resetSearchMutation,
  } = useMutation({
    mutationFn: (query: string) => searchChats(query),
  });
  const hasResults = !!searchResults && searchResults.length > 0;
  const errorMessage =
    typeof searchError === "string"
      ? searchError
      : searchError instanceof Error
      ? searchError.message
      : null;

  useEffect(() => {
    if (toDaysData) {
      setRecentChats(toDaysData);
    }
  }, [toDaysData]);

  const handleSearch = () => {
    const value = searchTerm.trim();
    if (!value) {
      return;
    }
    setLastQuery(value);
    triggerSearch(value);
  };

  const handleSelectResult = (result: SearchChatResult) => {
    setIsSearchOpen(false);
    setSearchTerm("");
    navigate(`/chats/${result.chat_id}`);
    resetSearchState();
  };

  const resetSearchState = () => {
    setSearchTerm("");
    setLastQuery("");
    resetSearchMutation();
  };

  return (
    <Dialog
      open={isSearchOpen}
      onOpenChange={(open) => {
        setIsSearchOpen(open);
        if (!open) {
          resetSearchState();
        }
      }}
    >
      <Sidebar className="bg-background text-foreground border-r">
        <SidebarContent className="flex flex-col justify-between h-full">
          <div>
            {/* Main Nav */}
            <SidebarGroup>
              <SidebarGroupLabel className="text-xs text-muted-foreground uppercase px-4 pt-4 pb-2">
                Main Menu
              </SidebarGroupLabel>
              <SidebarGroupContent>
                <SidebarMenu>
                  <SidebarMenuItem>
                    <SidebarMenuButton
                      className="flex items-center gap-3 px-4 py-2 rounded-md transition cursor-pointer hover:bg-muted"
                      onClick={() => setIsSearchOpen(true)}
                    >
                      <Search className="w-5 h-5 text-muted-foreground" />
                      <span className="text-sm font-medium">Search</span>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                </SidebarMenu>
              </SidebarGroupContent>
            </SidebarGroup>

            <div className="px-4 pt-4">
              <Button
                variant="secondary"
                className="w-full justify-start cursor-pointer gap-2"
                asChild
              >
                <Link to="/chats/new">
                  <MessageSquarePlus className="w-4 h-4" />
                  New Chat
                </Link>
              </Button>
            </div>

            {/* Recent Chats */}
            {recentChats.length == 0 || (
              <SidebarGroup className="mt-6">
                <SidebarGroupLabel className="text-xs text-muted-foreground uppercase px-4 pb-2">
                  Recent Chats
                </SidebarGroupLabel>
                <SidebarGroupContent>
                  <SidebarMenu>
                    {recentChats.map((chat: IChat) => (
                      <SidebarMenuItem key={chat.id}>
                        <NavLink to={`chats/${chat.id}`}>
                          {({ isActive }) => (
                            <SidebarMenuButton
                              className={cn(
                                "flex items-center gap-3 px-4 py-2 rounded-md transition cursor-pointer",
                                isActive ? "bg-muted" : "hover:bg-muted",
                                chat.status === "ended" && "opacity-60"
                              )}
                            >
                              <MessageSquare className="w-4 h-4 text-muted-foreground" />
                              <span className="text-sm truncate">
                                {(() => {
                                  const rawTitle =
                                    chat.title || "Untitled Chat";
                                  const startsWithQuote =
                                    rawTitle[0] == "'" || rawTitle[0] == '"';
                                  return startsWithQuote
                                    ? rawTitle.slice(1, -1) || "Untitled Chat"
                                    : rawTitle;
                                })()}
                              </span>
                              {chat.status === "ended" && (
                                <span className="ml-auto text-[10px] uppercase tracking-wide text-muted-foreground">
                                  Ended
                                </span>
                              )}
                            </SidebarMenuButton>
                          )}
                        </NavLink>
                      </SidebarMenuItem>
                    ))}
                  </SidebarMenu>
                </SidebarGroupContent>
              </SidebarGroup>
            )}
          </div>
        </SidebarContent>
      </Sidebar>

      <DialogContent className="space-y-4">
        <DialogHeader>
          <DialogTitle>Search Conversations</DialogTitle>
          <DialogDescription>
            Find previous chats by meaning, not just keywords.
          </DialogDescription>
        </DialogHeader>

        <div className="flex flex-col gap-3">
          <div className="flex flex-col gap-2 sm:flex-row">
            <Input
              placeholder="What are you looking for?"
              value={searchTerm}
              onChange={(event) => setSearchTerm(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === "Enter") {
                  event.preventDefault();
                  handleSearch();
                }
              }}
            />
            <Button
              className="sm:w-32"
              onClick={handleSearch}
              disabled={isSearching || !searchTerm.trim()}
            >
              {isSearching ? "Searching..." : "Search"}
            </Button>
          </div>
          {errorMessage && (
            <p className="text-sm text-destructive">{errorMessage}</p>
          )}
          {lastQuery && !isSearching && !hasResults && !searchError && (
            <p className="text-sm text-muted-foreground">
              No conversations matched “{lastQuery}”.
            </p>
          )}
        </div>

        <div className="max-h-72 overflow-y-auto space-y-2 pr-1">
          {isSearching && <TypingLoader />}

          {!isSearching &&
            searchResults &&
            searchResults.map((result) => (
              <button
                key={result.chat_id}
                type="button"
                onClick={() => handleSelectResult(result)}
                className={cn(
                  "w-full text-left rounded-md border border-border bg-muted/40 p-3 transition hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
                  result.status === "ended" && "opacity-85"
                )}
              >
                <div className="flex items-center justify-between gap-2">
                  <span className="font-medium truncate">{result.title}</span>
                  <span className="text-xs uppercase tracking-wide text-muted-foreground">
                    {result.status}
                  </span>
                </div>
                <p className="mt-2 text-sm text-muted-foreground line-clamp-3">
                  {result.snippet}
                </p>
                <p className="mt-2 text-[11px] text-muted-foreground">
                  Relevance: {(result.score * 100).toFixed(1)}%
                </p>
              </button>
            ))}
        </div>

        <DialogFooter className="sm:justify-end">
          <DialogClose asChild>
            <Button variant="ghost" type="button">
              Close
            </Button>
          </DialogClose>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
