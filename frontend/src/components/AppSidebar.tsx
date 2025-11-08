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
import { Link, NavLink } from "react-router-dom";
import { Button } from "./ui/button";
import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { getRecentChats } from "@/lib/api";
import { cn } from "@/lib/utils";

const mainNav = [{ title: "Search", url: "#", icon: Search }];

interface IChat {
  id: string;
  title: string;
  created: string;
}

export function AppSidebar() {
  const [recentChats, setRecentChats] = useState([]);

  const { data: toDaysData } = useQuery({
    queryKey: ["todaysChat"],
    queryFn: getRecentChats,
  });

  useEffect(() => {
    if (toDaysData) {
      setRecentChats(toDaysData);
    }
  }, [toDaysData]);

  return (
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
                {mainNav.map((item) => (
                  <SidebarMenuItem key={item.title}>
                    <SidebarMenuButton asChild>
                      <Link
                        to={item.url}
                        className="flex items-center gap-3 px-4 py-2 hover:bg-muted rounded-md transition"
                      >
                        <item.icon className="w-5 h-5 text-muted-foreground" />
                        <span className="text-sm font-medium">
                          {item.title}
                        </span>
                      </Link>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                ))}
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
                              isActive ? "bg-muted" : "hover:bg-muted"
                            )}
                          >
                            <MessageSquare className="w-4 h-4 text-muted-foreground" />
                            <span className="text-sm truncate">
                              {chat.title[0] == "'" || chat.title[0] == '"'
                                ? chat.title.slice(1, -1)
                                : chat.title}
                            </span>
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
  );
}
