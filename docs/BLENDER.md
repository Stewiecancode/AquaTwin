# Blender model integration

No final infrastructure model is generated or shipped. The reserved viewer is `client/components/DigitalTwinViewer.tsx`.

1. Model your approved water infrastructure in Blender. Use metres and stable, unique mesh names for pipelines/components. Apply transforms and retain a useful origin.
2. Export a GLB with embedded textures to `public/models/municipal-water-network.glb`.
3. Reload the Digital twin page. A HEAD check looks for the file. A missing model keeps the professional grid/placeholder visible instead of breaking the page.
4. Orbit with the mouse, zoom with the wheel, pan using orbit-control gestures, and use Reset camera to return to the starting view. The camera initially views the origin from `[12,10,12]`; large models may require zooming out.
5. For a browser-local preview, use **Preview model**. GLB or self-contained GLTF files work; GLTF files with separate binary/textures must be served with those resources through the application. Preview files are not persisted or uploaded to the backend.
6. As an administrator, open Sensor placement, select the sensor, enter its actual model X/Y/Z coordinates, and copy the Blender mesh name into Model component. Save. These coordinates persist in the sensor record.
7. Sensor markers are clickable. Incident mode highlights meshes linked through a sensor's asset ID to unresolved incidents. There is no inferred/guessed sensor placement.

The viewer deliberately does not centre or rescale imported models: stored coordinates remain in your model's world space. Measurements always come from the backend sensor stream. The model never generates real measurements or sends device commands.
