import { useQuery } from '@tanstack/react-query';
import { divIcon, type LatLngTuple } from 'leaflet';
import { useEffect } from 'react';
import { Link } from 'react-router-dom';
import { MapContainer, Marker, Popup, TileLayer, useMap } from 'react-leaflet';
import { getProjects } from '../services/portalService';
import type { Project } from '../types/domain';
import 'leaflet/dist/leaflet.css';

type ProjectLocation = {
  project: Project;
  position: LatLngTuple;
  color: string;
};

const townCoordinates: Record<string, LatLngTuple> = {
  'cape town|western cape': [-33.9249, 18.4241],
  'durban|kwazulu-natal': [-29.8587, 31.0218],
  'hermanus|western cape': [-34.4092, 19.2504],
  'mossel bay|western cape': [-34.1831, 22.1461],
  'paarl|western cape': [-33.7342, 18.9621],
  'rosebank|gauteng': [-26.1466, 28.0415],
  'sandton|gauteng': [-26.1076, 28.0567],
  'windhoek|namibia': [-22.5609, 17.0658],
};

const provinceCoordinates: Record<string, LatLngTuple> = {
  gauteng: [-26.2041, 28.0473],
  namibia: [-22.9576, 18.4904],
  'kwazulu-natal': [-29.0852, 30.5917],
  'western cape': [-33.2278, 21.8569],
};

const statusStyles: Record<Project['status'], { color: string; label: string }> = {
  awaiting_approval: { color: '#f59e0b', label: 'Awaiting approval' },
  cancelled: { color: '#94a3b8', label: 'Cancelled' },
  completed: { color: '#22c55e', label: 'Completed' },
  delayed: { color: '#ef4444', label: 'Delayed' },
  in_progress: { color: '#38bdf8', label: 'In progress' },
  on_hold: { color: '#a78bfa', label: 'On hold' },
};

function coordinateKey(project: Project) {
  return `${project.town}|${project.province}`.toLowerCase();
}

function getProjectPosition(project: Project): LatLngTuple {
  return townCoordinates[coordinateKey(project)] ?? provinceCoordinates[project.province.toLowerCase()] ?? [-28.4793, 24.6727];
}

function createProjectIcon(project: Project) {
  const style = statusStyles[project.status];

  return divIcon({
    className: '',
    html: `<span class="project-map-marker" style="--marker-color: ${style.color}"><span></span></span>`,
    iconAnchor: [13, 30],
    iconSize: [26, 30],
    popupAnchor: [0, -28],
  });
}

function FitProjectBounds({ locations }: { locations: ProjectLocation[] }) {
  const map = useMap();

  useEffect(() => {
    if (locations.length === 0) {
      return;
    }

    if (locations.length === 1) {
      map.setView(locations[0].position, 7);
      return;
    }

    map.fitBounds(locations.map((location) => location.position), {
      padding: [42, 42],
      maxZoom: 7,
    });
  }, [locations, map]);

  return null;
}

export function MapPage() {
  const { data: projects = [] } = useQuery({
    queryKey: ['projects'],
    queryFn: getProjects,
  });

  const locations = projects.map((project) => ({
    project,
    position: getProjectPosition(project),
    color: statusStyles[project.status].color,
  }));

  return (
    <div className="space-y-6">
      <section className="rounded-[2rem] border border-white/10 bg-white/6 p-6 shadow-soft">
        <h2 className="text-2xl font-semibold text-white">Map View</h2>
        <p className="mt-2 text-sm text-slate-400">Live branch locations with rollout status across South Africa and Namibia.</p>
      </section>

      <section className="grid gap-5 xl:grid-cols-[1fr_22rem]">
        <div className="overflow-hidden rounded-[2rem] border border-white/10 bg-slate-950/70 shadow-soft">
          <MapContainer
            center={[-28.8, 24.8]}
            zoom={5}
            minZoom={4}
            scrollWheelZoom
            className="h-[34rem] w-full"
          >
            <TileLayer
              attribution="&copy; OpenStreetMap contributors"
              url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
            />
            <FitProjectBounds locations={locations} />
            {locations.map(({ project, position }) => (
              <Marker key={project.id} position={position} icon={createProjectIcon(project)}>
                <Popup>
                  <div className="min-w-48 text-slate-900">
                    <p className="font-semibold">{project.branch}</p>
                    <p className="mt-1 text-xs text-slate-600">{project.town}, {project.province}</p>
                    <p className="mt-2 text-xs"><strong>Stage:</strong> {project.currentStage}</p>
                    <p className="text-xs"><strong>Status:</strong> {statusStyles[project.status].label}</p>
                    <p className="text-xs"><strong>Installer:</strong> {project.installer}</p>
                    <Link className="mt-3 inline-flex text-xs font-semibold text-sky-700" to={`/projects/${project.id}`}>
                      Open project
                    </Link>
                  </div>
                </Popup>
              </Marker>
            ))}
          </MapContainer>
        </div>

        <aside className="rounded-[2rem] border border-white/10 bg-slate-950/50 p-5 shadow-soft">
          <div className="flex items-center justify-between gap-3">
            <h3 className="text-lg font-semibold text-white">Live Locations</h3>
            <p className="rounded-full border border-white/10 bg-white/5 px-3 py-1 text-xs text-slate-300">{projects.length} projects</p>
          </div>
          <div className="mt-5 space-y-3">
            {locations.map(({ project, color }) => (
              <Link
                key={project.id}
                to={`/projects/${project.id}`}
                className="block rounded-2xl border border-white/10 bg-white/5 p-4 transition hover:border-sky-400/40 hover:bg-white/10"
              >
                <div className="flex items-start gap-3">
                  <span className="mt-1 h-3 w-3 shrink-0 rounded-full" style={{ backgroundColor: color }} />
                  <div>
                    <p className="font-semibold text-white">{project.branch}</p>
                    <p className="mt-1 text-sm text-slate-400">{project.town}, {project.province}</p>
                    <p className="mt-2 text-xs text-slate-300">{project.currentStage} · {statusStyles[project.status].label}</p>
                  </div>
                </div>
              </Link>
            ))}
          </div>
        </aside>
      </section>
    </div>
  );
}
