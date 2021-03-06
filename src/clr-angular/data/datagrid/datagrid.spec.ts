/*
 * Copyright (c) 2016-2017 VMware, Inc. All Rights Reserved.
 * This software is released under MIT license.
 * The full license information can be found in LICENSE in the root directory of this project.
 */
import {ChangeDetectionStrategy, Component, Input} from "@angular/core";
import {Subject} from "rxjs/Subject";

import {DatagridPropertyStringFilter} from "./built-in/filters/datagrid-property-string-filter";
import {DatagridStringFilterImpl} from "./built-in/filters/datagrid-string-filter-impl";
import {Datagrid} from "./datagrid";
import {TestContext} from "./helpers.spec";
import {Comparator} from "./interfaces/comparator";
import {Filter} from "./interfaces/filter";
import {State} from "./interfaces/state";
import {StringFilter} from "./interfaces/string-filter";
import {FiltersProvider} from "./providers/filters";
import {ExpandableRowsCount} from "./providers/global-expandable-rows";
import {HideableColumnService} from "./providers/hideable-column.service";
import {Items} from "./providers/items";
import {Page} from "./providers/page";
import {RowActionService} from "./providers/row-action-service";
import {Selection, SelectionType} from "./providers/selection";
import {Sort} from "./providers/sort";
import {DatagridRenderOrganizer} from "./render/render-organizer";

export default function(): void {
    describe("Datagrid component", function() {
        describe("Typescript API", function() {
            let context: TestContext<Datagrid, FullTest>;

            beforeEach(function() {
                context = this.create(Datagrid, FullTest, [HideableColumnService]);
            });

            it("allows to manually force a refresh of displayed items when data mutates", function() {
                const items: Items = context.getClarityProvider(Items);
                let refreshed = false;
                items.change.subscribe(() => refreshed = true);
                expect(refreshed).toBe(false);
                context.clarityDirective.dataChanged();
                expect(refreshed).toBe(true);
            });

            it("allows to manually resize the datagrid", function() {
                const organizer: DatagridRenderOrganizer = context.getClarityProvider(DatagridRenderOrganizer);
                let resizeDone: boolean = false;
                organizer.done.subscribe(() => {
                    resizeDone = true;
                });
                expect(resizeDone).toBe(false);
                context.clarityDirective.resize();
                expect(resizeDone).toBe(true);
            });
        });

        describe("Template API", function() {
            let context: TestContext<Datagrid, FullTest>;

            beforeEach(function() {
                context = this.create(Datagrid, FullTest, [HideableColumnService]);
            });

            it("receives an input for the loading state", function() {
                expect(context.clarityDirective.loading).toBe(false);
                context.testComponent.loading = true;
                context.detectChanges();
                expect(context.clarityDirective.loading).toBe(true);
            });

            it("offers two-way binding on the currently selected items", function() {
                const selection: Selection = context.getClarityProvider(Selection);
                context.testComponent.selected = [2];
                context.detectChanges();
                expect(selection.current).toEqual([2]);
                selection.setSelected(1, true);
                context.detectChanges();
                expect(context.testComponent.selected).toEqual([2, 1]);
            });

            it("allows to set pre-selected items when initializing the full list of items", function() {
                const selection: Selection = context.getClarityProvider(Selection);
                context.testComponent.items = [4, 5, 6];
                context.testComponent.selected = [5];
                context.detectChanges();
                expect(selection.current).toEqual([5]);
            });

            describe("clrDgRefresh output", function() {
                it("emits once when the datagrid is ready", function() {
                    expect(context.testComponent.nbRefreshed).toBe(1);
                });

                it("emits once when the sort order changes", function() {
                    context.testComponent.nbRefreshed = 0;
                    const sort: Sort = context.getClarityProvider(Sort);
                    sort.toggle(new TestComparator());
                    context.detectChanges();
                    expect(context.testComponent.nbRefreshed).toBe(1);
                });

                it("emits once when the filters change", function() {
                    context.testComponent.nbRefreshed = 0;
                    const filters: FiltersProvider = context.getClarityProvider(FiltersProvider);
                    const filter = new TestFilter();
                    filters.add(filter);
                    context.detectChanges();
                    expect(context.testComponent.nbRefreshed).toBe(1);
                });

                it("emits once when the filters change when currentPage > 1", function() {
                    // filter change should set the page to 1, so we expect two events that trigger emits
                    // datagrid should consolidate and still emit once
                    context.testComponent.items = [1, 2, 3, 4, 5, 6];
                    context.detectChanges();
                    const page: Page = context.getClarityProvider(Page);
                    page.size = 2;
                    page.current = 2;
                    context.testComponent.nbRefreshed = 0;
                    const filters: FiltersProvider = context.getClarityProvider(FiltersProvider);
                    const filter = new TestFilter();
                    filters.add(filter);
                    context.detectChanges();
                    expect(context.testComponent.nbRefreshed).toBe(1);
                });

                it("emits once when the page changes", function() {
                    context.testComponent.nbRefreshed = 0;
                    const page: Page = context.getClarityProvider(Page);
                    page.current = 2;
                    context.detectChanges();
                    expect(context.testComponent.nbRefreshed).toBe(1);
                });

                it("emits the complete state of the datagrid", function() {
                    context.testComponent.items = [1, 2, 3, 4, 5, 6];
                    context.detectChanges();
                    const comparator = new TestComparator();
                    const sort: Sort = context.getClarityProvider(Sort);
                    sort.toggle(comparator);
                    const filters: FiltersProvider = context.getClarityProvider(FiltersProvider);
                    const filter = new TestFilter();
                    filters.add(filter);
                    const page: Page = context.getClarityProvider(Page);
                    page.size = 2;
                    page.current = 2;
                    context.detectChanges();
                    expect(context.testComponent.latestState).toEqual({
                        page: {
                            from: 2,
                            to: 3,
                            size: 2,
                        },
                        sort: {
                            by: comparator,
                            reverse: false,
                        },
                        filters: [filter]
                    });
                });

                it("emits the correct data for all filter types", function() {
                    const filters: FiltersProvider = context.getClarityProvider(FiltersProvider);
                    const customFilter = new TestFilter();
                    const testStringFilter = new DatagridStringFilterImpl(new TestStringFilter());
                    testStringFilter.value = "whatever";
                    const builtinStringFilter = new DatagridStringFilterImpl(new DatagridPropertyStringFilter("test"));
                    builtinStringFilter.value = "1234";
                    filters.add(customFilter);      // custom filter
                    filters.add(testStringFilter);  // custom StringFilter ??
                    filters.add(builtinStringFilter);
                    context.detectChanges();
                    expect(context.testComponent.latestState.filters).toEqual([
                        customFilter, testStringFilter, {property: "test", value: "1234"}
                    ]);
                });

                it("emits early enough to avoid chocolate errors on the loading input", function() {
                    context.testComponent.fakeLoad = true;
                    const page: Page = context.getClarityProvider(Page);
                    page.current = 2;
                    expect(() => context.detectChanges()).not.toThrow();
                });

                // Actually not fixed yet, my bad
                xit("doesn't emit when the datagrid is destroyed", function() {
                    context.testComponent.filter = true;
                    context.detectChanges();
                    context.testComponent.nbRefreshed = 0;
                    context.testComponent.destroy = true;
                    context.detectChanges();
                    expect(context.testComponent.nbRefreshed).toBe(0);
                });
            });
        });

        describe("View basics", function() {
            let context: TestContext<Datagrid, FullTest>;

            beforeEach(function() {
                context = this.create(Datagrid, FullTest, [HideableColumnService]);
            });

            it("projects columns in the header", function() {
                const header = context.clarityElement.querySelector(".datagrid-head");
                expect(header.textContent).toMatch(/First\s*Second/);
            });

            it("projects the footer", function() {
                expect(context.clarityElement.querySelector(".datagrid-foot")).not.toBeNull();
            });
        });

        describe("Iterators", function() {
            it("projects rows when using ngFor", function() {
                this.context = this.create(Datagrid, NgForTest, [HideableColumnService]);
                const body = this.context.clarityElement.querySelector(".datagrid-body");
                expect(body.textContent).toMatch(/1\s*1\s*2\s*4\s*3\s*9/);
            });

            it("uses the rows template when using clrDgItems", function() {
                this.context = this.create(Datagrid, FullTest, [HideableColumnService]);
                const body = this.context.clarityElement.querySelector(".datagrid-body");
                expect(body.textContent).toMatch(/1\s*1\s*2\s*4\s*3\s*9/);
            });

            it("respects the trackBy option when using clrDgItems", function() {
                this.context = this.create(Datagrid, TrackByTest, [HideableColumnService]);
                const oldFirstRow = this.context.clarityElement.querySelector("clr-dg-row");
                this.context.testComponent.items = [42];
                this.context.detectChanges();
                const newFirstRow = this.context.clarityElement.querySelector("clr-dg-row");
                expect(newFirstRow).toBe(oldFirstRow);
            });
        });

        describe("Actionable rows", function() {
            let context: TestContext<Datagrid, ActionableRowTest>;
            let rowActionService: RowActionService;
            let headActionOverflowCell: HTMLElement;
            let actionOverflowCell: HTMLElement[];
            let actionOverflow: HTMLElement[];

            it("it has cells for action overflows if there is at least one of them.", function() {
                context = this.create(Datagrid, ActionableRowTest, [HideableColumnService]);
                rowActionService = context.getClarityProvider(RowActionService);
                expect(rowActionService.hasActionableRow).toBe(true);
                const datagridHead = context.clarityElement.querySelector(".datagrid-head");
                headActionOverflowCell = datagridHead.querySelector(".datagrid-column.datagrid-row-actions");
                actionOverflowCell = context.clarityElement.querySelectorAll("clr-dg-cell.datagrid-row-actions");
                actionOverflow = context.clarityElement.querySelectorAll("clr-dg-action-overflow");
                expect(headActionOverflowCell).not.toBeNull();
                expect(actionOverflowCell.length).toEqual(3);
                expect(actionOverflow.length).toEqual(3);
            });

            it("it has no cells for action overflows if there is none of them.", function() {
                context = this.create(Datagrid, ActionableRowTest, [HideableColumnService]);
                rowActionService = context.getClarityProvider(RowActionService);
                context.testComponent.showIfGreaterThan = 10;
                context.detectChanges();
                actionOverflow = context.clarityElement.querySelectorAll("clr-dg-action-overflow");
                expect(actionOverflow.length).toEqual(0);
                expect(rowActionService.hasActionableRow).toBe(false);
                const datagridHead = context.clarityElement.querySelector(".datagrid-head");
                headActionOverflowCell = datagridHead.querySelector(".datagrid-column.datagrid-row-actions");
                actionOverflowCell = context.clarityElement.querySelectorAll("clr-dg-cell.datagrid-single-select");
                expect(headActionOverflowCell).toBeNull();
                expect(actionOverflowCell.length).toEqual(0);
            });
        });

        describe("Expandable rows", function() {
            it("detects if there is at least one expandable row", function() {
                const context = this.create(Datagrid, ExpandableRowTest, [HideableColumnService]);
                const globalExpandableRows: ExpandableRowsCount = context.getClarityProvider(ExpandableRowsCount);
                expect(globalExpandableRows.hasExpandableRow).toBe(true);
                expect(context.clarityElement.querySelector(".datagrid-column.datagrid-expandable-caret"))
                    .not.toBeNull();
                context.testComponent.expandable = false;
                context.detectChanges();
                expect(globalExpandableRows.hasExpandableRow).toBe(false);
                expect(context.clarityElement.querySelector(".datagrid-column.datagrid-expandable-caret")).toBeNull();
            });
        });

        describe("Single selection", function() {
            let context: TestContext<Datagrid, SingleSelectionTest>;
            let selection: Selection;

            beforeEach(function() {
                context = this.create(Datagrid, SingleSelectionTest, [Selection]);
                selection = context.getClarityProvider(Selection);
            });

            describe("TypeScript API", function() {
                // None for now, would duplicate tests of Selection provider
            });

            describe("Template API", function() {
                it("sets the currentSingle binding", function() {
                    expect(selection.currentSingle).toBeNull();
                    context.testComponent.selected = 1;
                    context.detectChanges();
                    expect(selection.currentSingle).toEqual(1);
                    context.testComponent.selected = null;
                    context.detectChanges();
                    expect(selection.currentSingle).toBeNull();
                });

                it("offers two way binding on the currentSingle value", function() {
                    expect(selection.currentSingle).toBeNull();
                    context.testComponent.selected = 1;
                    context.detectChanges();
                    expect(selection.currentSingle).toEqual(1);
                    selection.currentSingle = 2;
                    context.detectChanges();
                    expect(context.testComponent.selected).toEqual(2);
                });
            });

            describe("View", function() {
                it("sets the proper selected class", function() {
                    const row = context.clarityElement.querySelectorAll(".datagrid-row")[1];
                    expect(row.classList.contains("datagrid-selected")).toBeFalsy();
                    selection.currentSingle = 1;
                    context.detectChanges();
                    expect(row.classList.contains("datagrid-selected")).toBeTruthy();
                });
            });
        });

        describe("Multi selection", function() {
            let context: TestContext<Datagrid, OnPushTest>;
            let selection: Selection;

            beforeEach(function() {
                context = this.create(Datagrid, OnPushTest, [Selection], [MultiSelectionTest]);
                selection = context.getClarityProvider(Selection);
            });

            describe("Template API", function() {
                it("sets the selected binding with OnPush", function() {
                    selection.selectionType = SelectionType.Multi;
                    expect(selection.current).toEqual(context.testComponent.selected);
                    context.testComponent.selected = [1];
                    context.detectChanges();
                    expect(selection.current).toEqual(context.testComponent.selected);
                    context.testComponent.selected = [];
                    context.detectChanges();
                    expect(selection.current).toEqual(context.testComponent.selected);
                });
            });
        });

        describe("Chocolate", function() {
            describe("clrDgItems", function() {
                it("doesn't taunt with chocolate on actionable rows", function() {
                    const context = this.create(Datagrid, ChocolateClrDgItemsTest);
                    context.testComponent.action = true;
                    expect(() => context.detectChanges()).not.toThrow();
                });

                it("doesn't taunt with chocolate on expandable rows", function() {
                    const context = this.create(Datagrid, ChocolateClrDgItemsTest);
                    context.testComponent.expandable = true;
                    expect(() => context.detectChanges()).not.toThrow();
                });
            });

            describe("ngFor", function() {
                it("doesn't taunt with chocolate on actionable rows", function() {
                    const context = this.create(Datagrid, ChocolateNgForTest);
                    context.testComponent.action = true;
                    expect(() => context.detectChanges()).not.toThrow();
                });

                it("doesn't taunt with chocolate on expandable rows", function() {
                    const context = this.create(Datagrid, ChocolateNgForTest);
                    context.testComponent.expandable = true;
                    expect(() => context.detectChanges()).not.toThrow();
                });
            });

            describe("column hidden by default", function() {
                it("doesn't taunt with chocolate on columns hidden by default", function() {
                    const context = this.create(Datagrid, HiddenColumnTest);
                    expect(() => context.detectChanges()).not.toThrow();
                });
            });
        });
    });
}

@Component({
    template: `
    <clr-datagrid *ngIf="!destroy"
                  [(clrDgSelected)]="selected" [clrDgLoading]="loading" (clrDgRefresh)="refresh($event)">
        <clr-dg-column>
            First
            <clr-dg-filter *ngIf="filter" [clrDgFilter]="testFilter"></clr-dg-filter>
        </clr-dg-column>
        <clr-dg-column>Second</clr-dg-column>
    
        <clr-dg-row *clrDgItems="let item of items">
            <clr-dg-cell>{{item}}</clr-dg-cell>
            <clr-dg-cell>{{item * item}}</clr-dg-cell>
        </clr-dg-row>
    
        <clr-dg-footer>{{items.length}} items</clr-dg-footer>
    </clr-datagrid>
`
})
class FullTest {
    items = [1, 2, 3];

    loading = false;
    selected: number[];

    nbRefreshed = 0;
    latestState: State;

    fakeLoad = false;

    // Filter needed to test the non-emission of refresh on destroy, even with an active filter
    filter = false;
    testFilter = new TestFilter();

    destroy = false;

    refresh(state: State) {
        this.nbRefreshed++;
        this.latestState = state;
        this.loading = this.fakeLoad;
    }
}

@Component({
    template: `
    <clr-datagrid>
        <clr-dg-column>First</clr-dg-column>
        <clr-dg-column>Second</clr-dg-column>
    
        <clr-dg-row *ngFor="let item of items">
            <clr-dg-cell>{{item}}</clr-dg-cell>
            <clr-dg-cell>{{item * item}}</clr-dg-cell>
        </clr-dg-row>
    
        <clr-dg-footer>{{items.length}} items</clr-dg-footer>
    </clr-datagrid>
`
})
class NgForTest {
    items = [1, 2, 3];
}

@Component({
    template: `
    <clr-datagrid>
        <clr-dg-column>First</clr-dg-column>
        <clr-dg-column>Second</clr-dg-column>
    
        <clr-dg-row *clrDgItems="let item of items; trackBy: trackByIndex">
            <clr-dg-cell>{{item}}</clr-dg-cell>
            <clr-dg-cell>{{item * item}}</clr-dg-cell>
        </clr-dg-row>
    
        <clr-dg-footer>{{items.length}} items</clr-dg-footer>
    </clr-datagrid>
`
})
class TrackByTest {
    items = [1, 2, 3];

    trackByIndex(index: number, item: any) {
        return index;
    }
}

// Have to wrap the OnPush component otherwise change detection doesn't run.
// The secret here is OnPush only updates on input changes, hence the wrapper.
@Component({
    template: `
    <multi-select-test [items]="items" [selected]="selected"></multi-select-test>
    `
})
class OnPushTest {
    items = [1, 2, 3];
    selected: any[] = [];
}

@Component({
    selector: "multi-select-test",
    template: `
    <clr-datagrid [(clrDgSelected)]="selected">
        <clr-dg-column>First</clr-dg-column>
        <clr-dg-column>Second</clr-dg-column>
    
        <clr-dg-row *clrDgItems="let item of items;" [clrDgItem]="item">
            <clr-dg-cell>{{item}}</clr-dg-cell>
            <clr-dg-cell>{{item * item}}</clr-dg-cell>
        </clr-dg-row>
    </clr-datagrid>`,
    changeDetection: ChangeDetectionStrategy.OnPush
})
class MultiSelectionTest {
    @Input() items: any[] = [];
    @Input() selected: any[] = [];
}

@Component({
    template: `
    <clr-datagrid [(clrDgSingleSelected)]="selected">
        <clr-dg-column>First</clr-dg-column>
        <clr-dg-column>Second</clr-dg-column>
    
        <clr-dg-row *clrDgItems="let item of items;" [clrDgItem]="item">
            <clr-dg-cell>{{item}}</clr-dg-cell>
            <clr-dg-cell>{{item * item}}</clr-dg-cell>
        </clr-dg-row>
    
        <clr-dg-footer (click)="selected = null">{{selected}}</clr-dg-footer>
    </clr-datagrid>
`
})
class SingleSelectionTest {
    items = [1, 2, 3];
    selected: any;
}

@Component({
    template: `
    <clr-datagrid>
        <clr-dg-column>First</clr-dg-column>
        <clr-dg-column>Second</clr-dg-column>
    
        <clr-dg-row *clrDgItems="let item of items;">
        
            <clr-dg-action-overflow *ngIf="item > showIfGreaterThan">
                <button class="action-item">Edit</button>
            </clr-dg-action-overflow>
                
            <clr-dg-cell>{{item}}</clr-dg-cell>
            <clr-dg-cell>{{item * item}}</clr-dg-cell>
        </clr-dg-row>
    
        <clr-dg-footer>{{items.length}} items</clr-dg-footer>
    </clr-datagrid>
`
})
class ActionableRowTest {
    items = [1, 2, 3];
    showIfGreaterThan = 0;
}

@Component({
    template: `
    <clr-datagrid>
        <clr-dg-column>First</clr-dg-column>
        <clr-dg-column>Second</clr-dg-column>
    
        <clr-dg-row *clrDgItems="let item of items;" [clrDgItem]="item">
            <clr-dg-cell>{{item}}</clr-dg-cell>
            <clr-dg-cell>{{item * item}}</clr-dg-cell>
            <ng-template [ngIf]="expandable">
                <clr-dg-row-detail *clrIfExpanded>Detail</clr-dg-row-detail>
            </ng-template>
        </clr-dg-row>
    
        <clr-dg-footer>{{items.length}} items</clr-dg-footer>
    </clr-datagrid>
`
})
class ExpandableRowTest {
    items = [1, 2, 3];
    expandable = true;
}


@Component({
    template: `
        <clr-datagrid>
            <clr-dg-column>First</clr-dg-column>
            <clr-dg-column>Second</clr-dg-column>

            <clr-dg-row *clrDgItems="let item of items; index as i">
                <clr-dg-action-overflow *ngIf="action && i === 1">
                    <button class="action-item">Edit</button>
                </clr-dg-action-overflow>
                <clr-dg-cell>{{item}}</clr-dg-cell>
                <clr-dg-cell>{{item * item}}</clr-dg-cell>
                <ng-template [ngIf]="expandable && i === 1">
                    <clr-dg-row-detail *clrIfExpanded>Detail</clr-dg-row-detail>
                </ng-template>
            </clr-dg-row>

            <clr-dg-footer>{{items.length}} items</clr-dg-footer>
        </clr-datagrid>
    `
})
class ChocolateClrDgItemsTest {
    items = [1, 2, 3];
    action = false;
    expandable = false;
}

@Component({
    template: `
        <clr-datagrid>
            <clr-dg-column>First</clr-dg-column>
            <clr-dg-column>Second</clr-dg-column>

            <clr-dg-row *ngFor="let item of items; index as i">
                <clr-dg-action-overflow *ngIf="action && i === 1">
                    <button class="action-item">Edit</button>
                </clr-dg-action-overflow>
                <clr-dg-cell>{{item}}</clr-dg-cell>
                <clr-dg-cell>{{item * item}}</clr-dg-cell>
                <ng-template [ngIf]="expandable && i === 1">
                    <clr-dg-row-detail *clrIfExpanded>Detail</clr-dg-row-detail>
                </ng-template>
            </clr-dg-row>

            <clr-dg-footer>{{items.length}} items</clr-dg-footer>
        </clr-datagrid>
    `
})
class ChocolateNgForTest {
    items = [1, 2, 3];
    action = false;
    expandable = false;
}

class TestComparator implements Comparator<number> {
    compare(a: number, b: number): number {
        return 0;
    }
}

class TestFilter implements Filter<number> {
    isActive(): boolean {
        return true;
    }

    accepts(n: number): boolean {
        return true;
    }

    changes = new Subject<boolean>();
}

class TestStringFilter implements StringFilter<number> {
    accepts(item: number, search: string) {
        return true;
    }
}


@Component({
    selector: "hidden-column-test",
    template: `
    <clr-datagrid>
        <clr-dg-column>
            <ng-container *clrDgHideableColumn="{hidden: true}">
                First
            </ng-container>
        </clr-dg-column>
        <clr-dg-column>Second</clr-dg-column>
    
        <clr-dg-row *ngFor="let item of items;">
            <clr-dg-cell>{{item}}</clr-dg-cell>
            <clr-dg-cell>{{item * item}}</clr-dg-cell>
        </clr-dg-row>
    </clr-datagrid>`
})
class HiddenColumnTest {
    items = [1, 2, 3];
}
