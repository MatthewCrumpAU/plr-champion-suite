"use client";

import Link from "next/link";
import { Check, ChevronsUpDown, FolderOpen, Plus } from "lucide-react";
import { useActiveProject, useProjects } from "@/lib/data/hooks";
import { Badge } from "@/components/ui/primitives";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/overlays";

export function ProjectSwitcher() {
  const { project, setActive } = useActiveProject();
  const { data: projects } = useProjects();

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button
          type="button"
          data-testid="project-switcher"
          className="flex max-w-[52vw] items-center gap-2 rounded-lg border bg-card px-2.5 py-1.5 text-left text-sm shadow-xs transition hover:bg-secondary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/40 sm:max-w-[320px]"
        >
          <FolderOpen className="size-4 shrink-0 text-muted-foreground" />
          <span className="truncate font-medium">{project ? project.name : "Choose a project"}</span>
          <ChevronsUpDown className="size-3.5 shrink-0 text-muted-foreground" />
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="w-80">
        <DropdownMenuLabel>Active project</DropdownMenuLabel>
        <div className="max-h-72 overflow-y-auto">
          {projects?.length ? (
            projects.map((p) => (
              <DropdownMenuItem key={p.id} onSelect={() => setActive(p.id)}>
                <span className="flex-1 truncate">{p.name}</span>
                {p.isSample && <Badge variant="sample">Sample</Badge>}
                {p.id === project?.id && <Check className="!text-primary" />}
              </DropdownMenuItem>
            ))
          ) : (
            <p className="px-2 py-3 text-sm text-muted-foreground">No projects yet.</p>
          )}
        </div>
        <DropdownMenuSeparator />
        {project && (
          <DropdownMenuItem asChild>
            <Link href={`/projects/view?id=${project.id}`}>
              <FolderOpen /> Open project dashboard
            </Link>
          </DropdownMenuItem>
        )}
        <DropdownMenuItem asChild>
          <Link href="/projects?new=1">
            <Plus /> New project
          </Link>
        </DropdownMenuItem>
        <DropdownMenuItem asChild>
          <Link href="/projects">Manage projects</Link>
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
