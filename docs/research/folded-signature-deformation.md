# Folded-signature deformation models

Context: [Wayfinder research ticket #3](https://github.com/NikolaiUgelvik/fold/issues/3), for the [physical design preview map](https://github.com/NikolaiUgelvik/fold/issues/1).

## Scope and reading of the question

This note surveys *representations*, not a product decision. It excludes finite-element simulation. A folded signature is treated as a paper sheet (or a small, nested set of sheets) with a fold at the binding; a page block is the settled stack on either side. The sources below support models for a browser preview, but do not validate a particular Fold UI, preset range, or visual target.

## Evidence-backed model families

### 1. Kinematic cylinder/cone page curl

Hong, Card, and Chen model a turn by deforming the page around a cone; the published model is the basis for the documented Microsoft implementation below [@hong2006]. Microsoft describes a complementary cylinder transform and blending it with conical curls: a cylinder for an edge pinch, a cone for a corner pinch, followed by a spine rotation [@microsoft2012].

* **What this supports.** A vertex-shader or CPU mesh deformation can preserve distance along the curl direction: for a cylinder, the flat distance `x` maps to angular displacement `x / radius` [@microsoft2012]. This gives a direct, deterministic single-leaf turn without a solver. Microsoft reports hand-tuning cone parameters, cylinder width, and spine rotation, and computes the transform per mesh vertex [@microsoft2012].
* **Candidate art parameters.** Turn progress; side; grab/curl position along the free edge; cylinder radius; cone apex/angle; cone–cylinder blend; spine angle; mesh resolution. These are the parameters exposed or described by the reference implementation, not recommended defaults [@microsoft2012].
* **Limitations.** This is an analytic pose, not a material model: it has no evidence-based state for paper thickness, nested leaves, crease history, self-contact, or residual set. The cited implementation is native C++, so its browser relevance is the per-vertex, mesh-local construction rather than a Web implementation [@microsoft2012].

### 2. Factorized page-block geometry plus one active developable sheet

Wolf, Cornillère, and Sorkine-Hornung present a non-FE, constrained discrete model designed for real-time books. Their active page is a discrete orthogonal geodesic net (DOG), while each settled page block is a planar midline curve extruded into a generalized cylinder [@wolf2021]. The authors tested the application through WebAssembly, as well as native and mobile targets [@wolf2021].

* **What this supports.** A nested-signature/page-block preview need not deform every leaf. The paper allocates full 3D deformation to an active sheet (or grabbed stack) and represents the remaining blocks by extruded midlines; it explicitly states that the active surface can represent a stack by extrusion [@wolf2021]. This is direct evidence for a low-complexity rest-block representation and a richer nearby turn.
* **Thickness and nesting.** The paper offsets active-page vertices by half the target thickness along vertex normals, and offsets/extrudes the block midline. Block thickness is changed as pages move between blocks; collision clearance includes the block thickness plus half the active-stack thickness [@wolf2021]. It also locally refines the binding offset and adapts segment lengths to make the characteristic sheared block profile [@wolf2021].
* **Candidate art parameters.** Per-sheet thickness; active-stack leaf count; left/right block counts; block-midline control points; binding position; page width/height; bending weight; binding/glue weight; active-page grid; optional opacity/translucency coefficient. The source uses an 11×8 active quad grid and a 15-node block midline in its experiment, and reports its own empirical weights; these are an existence proof, not portable preset values [@wolf2021].
* **Opening poses.** The same work uses a binding constraint and a glue-energy term between the binding normal and adjacent block tangents; it reports that larger bending weights stiffen pages and larger glue weights keep them more upright [@wolf2021]. Thus a static open pose can be represented by block midlines and a binding state even when no leaf is turning.
* **Limitations.** DOG developability does not itself enforce isometry; the paper adds a soft objective and reports visible geometry can hide resulting stretch [@wolf2021]. Its collision approximation omits self-collision and friction. Its binding is a straight, rigid rectangle; the authors identify flexible paperback spines and plastic effects as future extensions [@wolf2021]. It is therefore evidence for a capable constrained model, not evidence that crease set or sewn signatures are covered.

### 3. Explicit residual-crease state

For material evidence that a crease is not purely elastic, Inoue et al. measured repeated folding of scored coated paperboard and analyzed permanent residual deformation angle, residual stiffness variation, and bending-moment hysteresis [@inoue2011]. Ivashtenko et al. experimentally studied a single paper crease and report that its non-elastic properties are crucial to their origami behaviour [@ivashtenko2019].

* **What this supports.** If art direction needs a visibly set fold, a representation needs at least persistent crease state rather than only a transient bend. A minimal state vector can be expressed as rest fold angle, crease-band width, and a stiffness/hysteresis scalar. Those are candidate controls derived from the measured categories above; the sources do **not** establish a universal mapping from those controls to a particular paper stock [@inoue2011; @ivashtenko2019].
* **Limitations.** The cited experiments concern scored board and Miura-ori-type paper, not a sewn or nested book signature. They support the existence of residual angle/stiffness/hysteresis, but not calibration ranges for Fold or a substitute for measured material samples [@inoue2011; @ivashtenko2019]. Wolf et al. similarly leave plastic binding effects as future work [@wolf2021].

## Cross-cutting evidence and boundaries

* Paper is well approximated by a developable surface for bending/creasing: Wolf et al. describe a page as isometric to a planar rectangle that bends or creases but does not stretch or compress [@wolf2021]. This supports preserving sheet metrics in either an analytic curl or a constrained developable surface.
* The factorized model has browser-relevant performance evidence, but it is not a no-simulation model: it uses implicit integration, constraints, and collision correction. The analytic curl is simpler but lacks page-block and residual-state evidence. These are trade-offs for later specification, not a selection [@wolf2021; @microsoft2012].
* There is no source in this review establishing a visual or mechanical model for thread, sewing, cover hinges, or the exact interaction between nested folded signatures. Those items remain outside the map's V1 scope or require dedicated evidence [Wayfinder #1](https://github.com/NikolaiUgelvik/fold/issues/1).

## Source register

<a id="hong2006"></a>**[@hong2006]** Hong, L., Card, S. K., and Chen, J. “Turning Pages of 3D Electronic Books.” *IEEE Symposium on 3D User Interfaces*, 2006, pp. 159–165. DOI: [10.1109/3DUI.2006.1631665](https://doi.org/10.1109/3DUI.2006.1631665). Peer-reviewed conference publication. The cone construction is identified by Microsoft as its source [@microsoft2012].

<a id="microsoft2012"></a>**[@microsoft2012]** Brumer, E. “Project Austin Part 2 of 6: Page Curling.” Microsoft C++ Team Blog, 2012. [Official technical publication and documented reference implementation](https://devblogs.microsoft.com/cppblog/project-austin-part-2-of-6-page-curling/).

<a id="wolf2021"></a>**[@wolf2021]** Wolf, T., Cornillère, V., and Sorkine-Hornung, O. “Physically-based Book Simulation with Freeform Developable Surfaces.” *Computer Graphics Forum* 40(2), Eurographics 2021. DOI: [10.1111/cgf.142646](https://doi.org/10.1111/cgf.142646). [Author-hosted paper and project page](https://igl.ethz.ch/projects/book-simulation/). Peer-reviewed publication.

<a id="inoue2011"></a>**[@inoue2011]** Inoue, Y., et al. “Bending Moment Characteristics on Repeated Folding Motion of Coated Paperboard Scored by Round-Edge Knife.” *Journal of Advanced Mechanical Design, Systems, and Manufacturing* 5(4), 2011, pp. 385–394. DOI: [10.1299/jamdsm.5.385](https://doi.org/10.1299/jamdsm.5.385). [Publisher abstract](https://www.jstage.jst.go.jp/article/jamdsm/5/4/5_4_385/_article/-char/en). Peer-reviewed journal publication.

<a id="ivashtenko2019"></a>**[@ivashtenko2019]** Ivashtenko, O., Kofman, P. O., Golubov, O., and Maizelis, Z. A. “Origami launcher.” *Emergent Scientist* 3, article 5, 2019. DOI: [10.1051/emsci/2019004](https://doi.org/10.1051/emsci/2019004). [Publisher full text](https://emergent-scientist.edp-open.org/articles/emsci/full_html/2019/01/emsci180009/emsci180009.html). Peer-reviewed article.
