# Fold

Fold is a browser application for designing printable notebook pages and
constructing them for physical binding.

## Language

**Notebook Document**:
The derived printable notebook configuration: page layouts, imposed sides, and
page-specific appearance.
_Avoid_: Book model, document state

**Physical Design Preview**:
A visual representation of a Notebook Document as a constructed paper object.
It is a preview, not a separate authoring surface.
_Avoid_: 3D editor, book simulator

**Folded Sheet**:
One physical paper sheet folded at its binding edge, producing two leaves and
four page sides.
_Avoid_: Page, leaf

**Signature**:
A nested group of Folded Sheets constructed as one unit in a Page Block.
_Avoid_: Section, bundle

**Page Block**:
The assembled collection of Signatures and their Page surfaces, excluding a
cover and visible sewing thread.
_Avoid_: Book, binding

**Leaf Stack**:
The ordered stack of unfolded sheets secured at a binding edge for a yotsume
Notebook Document. It is distinct from a Page Block.
_Avoid_: Signature, Page Block

**Reader Pose**:
The closed or open state that presents a Page Block for sequential reading while
retaining its constructed Signatures and Folded Sheets.
_Avoid_: Imposition view, book page state

**Material Preset**:
A preview-local set of paper-behaviour values applied to one Physical Design
Preview. It is distinct from the Notebook Document's paper format.
_Avoid_: Paper preset, paper size
