import { useQuery } from '@tanstack/react-query';
import { divIcon, type LatLngTuple } from 'leaflet';
import { useEffect } from 'react';
import { Link } from 'react-router-dom';
import { MapContainer, Marker, Popup, TileLayer, useMap } from 'react-leaflet';
import { getProjects } from '../services/portalService';
import { useAuth } from '../contexts/AuthContext';
import { filterProjectsForUser } from '../utils/permissions';
import type { Project } from '../types/domain';
import 'leaflet/dist/leaflet.css';

type ProjectLocation = {
  project: Project;
  position: LatLngTuple;
  color: string;
};

const branchCoordinates: Record<string, LatLngTuple> = {
  'PSG-SAMPLE-BFN-005': [-29.0852, 26.1596],
  'PSG-SAMPLE-CTN-001': [-33.9035, 18.4207],
  'PSG-SAMPLE-DBN-004': [-29.7253, 31.0665],
  'PSG-SAMPLE-EL-006': [-33.0153, 27.9116],
  'PSG-SAMPLE-JHB-002': [-26.1466, 28.0415],
  'PSG-SAMPLE-MBK-010': [-25.4753, 30.9694],
  'PSG-SAMPLE-PLK-009': [-23.9045, 29.4689],
  'PSG-SAMPLE-PTA-003': [-25.7863, 28.3155],
  'PSG-SAMPLE-WHK-007': [-22.5609, 17.0658],
  'PSG-SAMPLE-WVB-008': [-22.9576, 14.5053],
};

const townCoordinates: Record<string, LatLngTuple> = {
  'bloemfontein|free state': [-29.0852, 26.1596],
  'cape town|western cape': [-33.9249, 18.4241],
  'durban|kwazulu-natal': [-29.8587, 31.0218],
  'east london|eastern cape': [-33.0192, 27.8999],
  'hermanus|western cape': [-34.4092, 19.2504],
  'johannesburg|gauteng': [-26.2041, 28.0473],
  'mbombela|mpumalanga': [-25.4753, 30.9694],
  'mossel bay|western cape': [-34.1831, 22.1461],
  'paarl|western cape': [-33.7342, 18.9621],
  'polokwane|limpopo': [-23.9045, 29.4689],
  'pretoria|gauteng': [-25.7479, 28.2293],
  'rosebank|gauteng': [-26.1466, 28.0415],
  'sandton|gauteng': [-26.1076, 28.0567],
  'umhlanga|kwazulu-natal': [-29.7253, 31.0665],
  'walvis bay|namibia': [-22.9576, 14.5053],
  'windhoek|namibia': [-22.5609, 17.0658],
};

const provinceCoordinates: Record<string, LatLngTuple> = {
  'eastern cape': [-32.2968, 26.4194],
  'free state': [-28.4541, 26.7968],
  gauteng: [-26.2041, 28.0473],
  limpopo: [-23.4013, 29.4179],
  mpumalanga: [-25.5653, 30.5279],
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
  return branchCoordinates[project.id] ?? townCoordinates[coordinateKey(project)] ?? provinceCoordinates[project.province.toLowerCase()] ?? [-28.4793, 24.6727];
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
  const { user } = useAuth();
  const { data: projects = [] } = useQuery({
    queryKey: ['projects'],
    queryFn: getProjects,
  });

  const scopedProjects = filterProjectsForUser(projects, user);
  const locations = scopedProjects.map((project) => ({
    project,
    position: getProjectPosition(project),
    color: statusStyles[project.status].color,
  }));
  const statusCounts = locations.reduce<Record<Project['status'], number>>((counts, { project }) => {
    counts[project.status] += 1;
    return counts;
  }, {
    awaiting_approval: 0,
    cancelled: 0,
    completed: 0,
    delayed: 0,
    in_progress: 0,
    on_hold: 0,
  });

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
            <p className="rounded-full border border-white/10 bg-white/5 px-3 py-1 text-xs text-slate-300">{scopedProjects.length} projects</p>
          </div>
          <div className="mt-4 grid grid-cols-2 gap-2 text-xs text-slate-300">
            {Object.entries(statusStyles).map(([status, style]) => (
              <div key={status} className="flex items-center justify-between gap-3 rounded-2xl border border-white/10 bg-white/5 px-3 py-2">
                <span className="flex items-center gap-2">
                  <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: style.color }} />
                  {style.label}
                </span>
                <span className="font-semibold text-white">{statusCounts[status as Project['status']]}</span>
              </div>
            ))}
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
