import React, { useState, useMemo } from 'react';
import {
  Briefcase,
  Wrench,
  Layers,
  Plus,
  Trash2,
  Edit3,
  Copy,
  FileText,
  CheckCircle2,
  Percent,
  Calculator,
  Search,
  Scale,
  Building,
  Sparkles,
  X,
  ChevronDown,
  ChevronUp,
  Printer,
  Boxes,
  UserCheck
} from 'lucide-react';
import {
  ProductionProjectCostEstimate,
  ProjectMaterialEstimate,
  ProjectLabourOperation,
  RawStockItem,
  Factory,
  CustomLedger,
  Worker,
  AppLanguage
} from '../types';
import { fmt, todayISO } from '../utils/helpers';

interface ProjectCostingSectionProps {
  projects: ProductionProjectCostEstimate[];
  rawStock: RawStockItem[];
  factories: Factory[];
  customLedgers: CustomLedger[];
  workers: Worker[];
  companyName: string;
  language: AppLanguage;
  onSaveProject: (project: ProductionProjectCostEstimate) => void;
  onDeleteProject: (id: string) => void;
}

// Standard down rod sizes and standard weights in kg
const STANDARD_SIZES_WEIGHTS: Record<string, number> = {
  '6"': 0.35,
  '12"': 0.60,
  '18"': 0.85,
  '24"': 1.15,
  '30"': 1.40,
  '36"': 1.70,
  '48"': 2.20,
  '60"': 2.75
};

// Default standard labour operations for fan rod manufacturing in Gujrat
const DEFAULT_LABOUR_OPERATIONS: { name: string; rate: number; defaultWorker: string }[] = [
  { name: 'Pipe Cutting & Sizing', rate: 4.0, defaultWorker: 'Lathe Cutter' },
  { name: 'Hole Punching & Drilling', rate: 3.5, defaultWorker: 'Press Operator' },
  { name: 'Swaging & Threading (Lathe)', rate: 4.5, defaultWorker: 'Lathe Operator' },
  { name: 'Deburring & Surface Polishing', rate: 2.5, defaultWorker: 'Deburring Station' },
  { name: 'Electrostatic Powder Coating', rate: 7.5, defaultWorker: 'Painter / Coater' },
  { name: 'Hardware Assembly & Quality Inspection', rate: 3.0, defaultWorker: 'Assembly Bench' },
  { name: 'Packaging & Bundle Sleeving', rate: 2.0, defaultWorker: 'Packing Desk' }
];

export const ProjectCostingSection: React.FC<ProjectCostingSectionProps> = ({
  projects = [],
  rawStock = [],
  factories = [],
  customLedgers = [],
  workers = [],
  companyName,
  language,
  onSaveProject,
  onDeleteProject
}) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [targetFilter, setTargetFilter] = useState<'all' | 'customer' | 'factory'>('all');
  const [statusFilter, setStatusFilter] = useState<'all' | 'draft' | 'in_progress' | 'completed'>('all');
  const [expandedProjectId, setExpandedProjectId] = useState<string | null>(null);

  // Editor Modal State
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingProject, setEditingProject] = useState<ProductionProjectCostEstimate | null>(null);

  // Print/View Cost Sheet Modal State
  const [printProject, setPrintProject] = useState<ProductionProjectCostEstimate | null>(null);

  // Form State for Editor
  const [formName, setFormName] = useState('');
  const [formTargetType, setFormTargetType] = useState<'customer' | 'factory'>('factory');
  const [formTargetPartyName, setFormTargetPartyName] = useState('');
  const [formRodSize, setFormRodSize] = useState('18"');
  const [formGauge, setFormGauge] = useState('16 Gauge');
  const [formDiameter, setFormDiameter] = useState('3/4"');
  const [formBatchQty, setFormBatchQty] = useState('500');
  const [formStatus, setFormStatus] = useState<'draft' | 'in_progress' | 'completed' | 'billed'>('in_progress');
  const [formOverheadPerUnit, setFormOverheadPerUnit] = useState('2.5');
  const [formQuotedPrice, setFormQuotedPrice] = useState('420');
  const [formNotes, setFormNotes] = useState('');

  // Material and Labour line items state
  const [formMaterials, setFormMaterials] = useState<ProjectMaterialEstimate[]>([]);
  const [formLabour, setFormLabour] = useState<ProjectLabourOperation[]>([]);

  // Filtered projects
  const filteredProjects = useMemo(() => {
    return projects.filter(p => {
      if (targetFilter !== 'all' && p.targetType !== targetFilter) return false;
      if (statusFilter !== 'all' && p.status !== statusFilter) return false;
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const matchName = p.projectName.toLowerCase().includes(q);
        const matchParty = p.targetPartyName.toLowerCase().includes(q);
        const matchSize = p.rodSize.toLowerCase().includes(q);
        return matchName || matchParty || matchSize;
      }
      return true;
    });
  }, [projects, targetFilter, statusFilter, searchQuery]);

  // Aggregate stats across all projects
  const stats = useMemo(() => {
    const totalCount = projects.length;
    const totalUnits = projects.reduce((sum, p) => sum + (p.batchQuantity || 0), 0);
    const totalCustomerSteelSaved = projects.reduce(
      (sum, p) => sum + (p.customerSuppliedWeightSavedKg || 0),
      0
    );
    const avgProductionCost =
      totalCount > 0
        ? projects.reduce((sum, p) => sum + (p.productionCostPerUnit || 0), 0) / totalCount
        : 0;
    const avgProfitMargin =
      totalCount > 0
        ? projects.reduce((sum, p) => sum + (p.profitMarginPercent || 0), 0) / totalCount
        : 0;

    return { totalCount, totalUnits, totalCustomerSteelSaved, avgProductionCost, avgProfitMargin };
  }, [projects]);

  // Real-time calculations inside editor
  const parsedBatchQty = Math.max(1, parseInt(formBatchQty, 10) || 1);
  const parsedOverheadPerUnit = parseFloat(formOverheadPerUnit) || 0;
  const parsedQuotedPrice = parseFloat(formQuotedPrice) || 0;

  // Material totals in form
  const computedMaterials = useMemo(() => {
    let totalMaterialCost = 0;
    let customerSteelWeightSavedKg = 0;

    const items = formMaterials.map(m => {
      const isCustomerSupplied = m.sourceType === 'customer_provided';
      const effectiveRate = isCustomerSupplied ? 0 : m.unitRate;
      const totalQuantityOrWeight = Number((m.consumptionPerUnit * parsedBatchQty).toFixed(2));
      const totalCost = Math.round(totalQuantityOrWeight * effectiveRate);

      if (!isCustomerSupplied) {
        totalMaterialCost += totalCost;
      } else if (m.unit.toLowerCase() === 'kg') {
        customerSteelWeightSavedKg += totalQuantityOrWeight;
      }

      return {
        ...m,
        unitRate: effectiveRate,
        totalQuantityOrWeight,
        totalCost
      };
    });

    const materialCostPerUnit = Number((totalMaterialCost / parsedBatchQty).toFixed(2));
    return { items, totalMaterialCost, materialCostPerUnit, customerSteelWeightSavedKg };
  }, [formMaterials, parsedBatchQty]);

  // Labour totals in form
  const computedLabour = useMemo(() => {
    let totalLabourCost = 0;
    let labourCostPerUnit = 0;

    const items = formLabour.map(l => {
      const lineCost = Math.round(l.ratePerUnit * parsedBatchQty);
      totalLabourCost += lineCost;
      labourCostPerUnit += l.ratePerUnit;
      return {
        ...l,
        totalCost: lineCost
      };
    });

    return { items, totalLabourCost, labourCostPerUnit };
  }, [formLabour, parsedBatchQty]);

  // Grand summary in form
  const computedTotals = useMemo(() => {
    const totalOverheadCost = Math.round(parsedOverheadPerUnit * parsedBatchQty);
    const totalProductionCost =
      computedMaterials.totalMaterialCost + computedLabour.totalLabourCost + totalOverheadCost;
    const productionCostPerUnit = Number((totalProductionCost / parsedBatchQty).toFixed(2));
    const expectedRevenue = Math.round(parsedQuotedPrice * parsedBatchQty);
    const expectedProfitTotal = expectedRevenue - totalProductionCost;
    const expectedProfitPerUnit = Number((parsedQuotedPrice - productionCostPerUnit).toFixed(2));
    const profitMarginPercent =
      parsedQuotedPrice > 0 ? Number(((expectedProfitPerUnit / parsedQuotedPrice) * 100).toFixed(1)) : 0;

    return {
      totalOverheadCost,
      totalProductionCost,
      productionCostPerUnit,
      expectedRevenue,
      expectedProfitTotal,
      expectedProfitPerUnit,
      profitMarginPercent
    };
  }, [computedMaterials, computedLabour, parsedOverheadPerUnit, parsedBatchQty, parsedQuotedPrice]);

  // Open editor for a new project
  const handleOpenNewProject = (presetType?: 'falcon_standard' | 'customer_khari') => {
    const defaultFactory = factories[0]?.name || 'Al-Madina Fan Workshop';
    setEditingProject(null);
    setFormName(
      presetType === 'customer_khari'
        ? '24" Heavy Job-Work (Customer Pipe Khari)'
        : '18" Deluxe Down Rod Production'
    );
    setFormTargetType(presetType === 'customer_khari' ? 'customer' : 'factory');
    setFormTargetPartyName(
      presetType === 'customer_khari'
        ? (customLedgers[0]?.name || 'Super Asia Ancillary Job-Work')
        : defaultFactory
    );
    setFormRodSize(presetType === 'customer_khari' ? '24"' : '18"');
    setFormGauge(presetType === 'customer_khari' ? '14 Gauge' : '16 Gauge');
    setFormDiameter(presetType === 'customer_khari' ? '1"' : '3/4"');
    setFormBatchQty('500');
    setFormStatus('in_progress');
    setFormOverheadPerUnit(presetType === 'customer_khari' ? '3.0' : '2.5');
    setFormQuotedPrice(presetType === 'customer_khari' ? '165' : '420');
    setFormNotes(
      presetType === 'customer_khari'
        ? 'Customer provided raw steel pipe. Falcon charges only for direct labour and hardware fittings.'
        : 'Full production batch with pure white polyester powder coating and safety bolt fitting.'
    );

    if (presetType === 'customer_khari') {
      // Customer provides steel
      setFormMaterials([
        {
          id: `mat_${Date.now()}_1`,
          materialName: 'Customer M.S. Heavy Steel Pipe 14G',
          sourceType: 'customer_provided',
          consumptionPerUnit: 1.15,
          unit: 'kg',
          unitRate: 0,
          totalQuantityOrWeight: 575,
          totalCost: 0,
          notes: 'Customer brings raw pipe'
        },
        {
          id: `mat_${Date.now()}_2`,
          materialName: 'Safety Bolt Fitting Heavy',
          sourceType: 'factory_supplied',
          consumptionPerUnit: 1,
          unit: 'pcs',
          unitRate: 16,
          totalQuantityOrWeight: 500,
          totalCost: 8000
        },
        {
          id: `mat_${Date.now()}_3`,
          materialName: 'Rubber Bushings & Canopy Rings',
          sourceType: 'factory_supplied',
          consumptionPerUnit: 1,
          unit: 'pcs',
          unitRate: 8,
          totalQuantityOrWeight: 500,
          totalCost: 4000
        },
        {
          id: `mat_${Date.now()}_4`,
          materialName: 'Epoxy Matte Black Powder',
          sourceType: 'factory_supplied',
          consumptionPerUnit: 0.06,
          unit: 'kg',
          unitRate: 1100,
          totalQuantityOrWeight: 30,
          totalCost: 33000
        }
      ]);
    } else {
      // Falcon supplies steel
      setFormMaterials([
        {
          id: `mat_${Date.now()}_1`,
          materialName: 'M.S. Steel Pipe (16 Gauge - 3/4" Dia)',
          sourceType: 'factory_supplied',
          consumptionPerUnit: 0.85,
          unit: 'kg',
          unitRate: 290,
          totalQuantityOrWeight: 425,
          totalCost: 123250
        },
        {
          id: `mat_${Date.now()}_2`,
          materialName: 'Safety Bolt & Cotter Pin Fittings',
          sourceType: 'factory_supplied',
          consumptionPerUnit: 1,
          unit: 'pcs',
          unitRate: 14,
          totalQuantityOrWeight: 500,
          totalCost: 7000
        },
        {
          id: `mat_${Date.now()}_3`,
          materialName: 'Rubber Bushings & Canopy Rings',
          sourceType: 'factory_supplied',
          consumptionPerUnit: 1,
          unit: 'pcs',
          unitRate: 6,
          totalQuantityOrWeight: 500,
          totalCost: 3000
        },
        {
          id: `mat_${Date.now()}_4`,
          materialName: 'Pure White Polyester Powder',
          sourceType: 'factory_supplied',
          consumptionPerUnit: 0.05,
          unit: 'kg',
          unitRate: 1200,
          totalQuantityOrWeight: 25,
          totalCost: 30000
        }
      ]);
    }

    // Default labour operations
    setFormLabour(
      DEFAULT_LABOUR_OPERATIONS.map((op, idx) => ({
        id: `lab_${Date.now()}_${idx}`,
        name: op.name,
        ratePerUnit: op.rate,
        workerName: workers[idx % (workers.length || 1)]?.name || op.defaultWorker,
        totalCost: op.rate * 500,
        isCompleted: false
      }))
    );

    setIsModalOpen(true);
  };

  // Open editor for an existing project
  const handleEditProject = (project: ProductionProjectCostEstimate) => {
    setEditingProject(project);
    setFormName(project.projectName);
    setFormTargetType(project.targetType);
    setFormTargetPartyName(project.targetPartyName);
    setFormRodSize(project.rodSize);
    setFormGauge(project.gauge || '16 Gauge');
    setFormDiameter(project.diameter || '3/4"');
    setFormBatchQty(String(project.batchQuantity));
    setFormStatus(project.status);
    setFormOverheadPerUnit(String(project.overheadPerUnit || 2.5));
    setFormQuotedPrice(String(project.quotedPricePerUnit || 0));
    setFormNotes(project.notes || '');
    setFormMaterials(project.materialEstimates || []);
    setFormLabour(project.labourOperations || []);
    setIsModalOpen(true);
  };

  // Duplicate a project
  const handleDuplicateProject = (project: ProductionProjectCostEstimate) => {
    const duplicated: ProductionProjectCostEstimate = {
      ...project,
      id: `proj_${Date.now()}`,
      projectName: `${project.projectName} (Copy)`,
      date: todayISO(),
      status: 'draft',
      createdAt: todayISO(),
      updatedAt: todayISO(),
      materialEstimates: (project.materialEstimates || []).map(m => ({
        ...m,
        id: `mat_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`
      })),
      labourOperations: (project.labourOperations || []).map(l => ({
        ...l,
        id: `lab_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
        isCompleted: false
      }))
    };
    onSaveProject(duplicated);
  };

  // Add a material row in editor
  const handleAddMaterialRow = () => {
    const defaultRaw = rawStock[0];
    const newRow: ProjectMaterialEstimate = {
      id: `mat_${Date.now()}`,
      materialName: defaultRaw?.name || 'M.S. Steel Pipe (16 Gauge)',
      sourceType: 'factory_supplied',
      consumptionPerUnit: 0.85,
      unit: defaultRaw?.unit || 'kg',
      unitRate: 290,
      totalQuantityOrWeight: 0.85 * parsedBatchQty,
      totalCost: Math.round(0.85 * parsedBatchQty * 290)
    };
    setFormMaterials([...formMaterials, newRow]);
  };

  // Remove a material row
  const handleRemoveMaterialRow = (id: string) => {
    setFormMaterials(formMaterials.filter(m => m.id !== id));
  };

  // Add a labour row in editor
  const handleAddLabourRow = () => {
    const newRow: ProjectLabourOperation = {
      id: `lab_${Date.now()}`,
      name: 'Custom Labour Operation',
      ratePerUnit: 3.5,
      workerName: workers[0]?.name || 'Workshop Worker',
      totalCost: 3.5 * parsedBatchQty,
      isCompleted: false
    };
    setFormLabour([...formLabour, newRow]);
  };

  // Remove a labour row
  const handleRemoveLabourRow = (id: string) => {
    setFormLabour(formLabour.filter(l => l.id !== id));
  };

  // Save project form
  const handleSaveForm = (e: React.FormEvent) => {
    e.preventDefault();
    if (!formName.trim() || !formTargetPartyName.trim()) return;

    const updatedProject: ProductionProjectCostEstimate = {
      id: editingProject ? editingProject.id : `proj_${Date.now()}`,
      projectName: formName.trim(),
      targetType: formTargetType,
      targetPartyName: formTargetPartyName.trim(),
      rodSize: formRodSize,
      gauge: formGauge,
      diameter: formDiameter,
      batchQuantity: parsedBatchQty,
      date: editingProject ? editingProject.date : todayISO(),
      status: formStatus,
      materialEstimates: computedMaterials.items,
      labourOperations: computedLabour.items,
      overheadPerUnit: parsedOverheadPerUnit,
      quotedPricePerUnit: parsedQuotedPrice,
      totalMaterialCost: computedMaterials.totalMaterialCost,
      materialCostPerUnit: computedMaterials.materialCostPerUnit,
      totalLabourCost: computedLabour.totalLabourCost,
      labourCostPerUnit: computedLabour.labourCostPerUnit,
      totalOverheadCost: computedTotals.totalOverheadCost,
      overheadCostPerUnit: parsedOverheadPerUnit,
      totalProductionCost: computedTotals.totalProductionCost,
      productionCostPerUnit: computedTotals.productionCostPerUnit,
      expectedRevenue: computedTotals.expectedRevenue,
      expectedProfitTotal: computedTotals.expectedProfitTotal,
      expectedProfitPerUnit: computedTotals.expectedProfitPerUnit,
      profitMarginPercent: computedTotals.profitMarginPercent,
      customerSuppliedWeightSavedKg: computedMaterials.customerSteelWeightSavedKg,
      notes: formNotes.trim(),
      createdAt: editingProject ? editingProject.createdAt : todayISO(),
      updatedAt: todayISO()
    };

    onSaveProject(updatedProject);
    setIsModalOpen(false);
  };

  return (
    <div className="space-y-4 font-mono">
      {/* KPI Stats Ribbon */}
      <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
        <div className="p-3 rounded-xl bg-[var(--panel)] border border-[var(--steel-line)] flex flex-col justify-between">
          <div className="text-[10px] uppercase text-[var(--text-dim)] flex items-center gap-1.5">
            <Briefcase size={12} className="text-amber-400" />
            <span>Active Projects</span>
          </div>
          <div className="text-xl font-bold text-[var(--text)] mt-1 font-mono">
            {stats.totalCount} <span className="text-xs text-zinc-400 font-normal">batches</span>
          </div>
          <div className="text-[10px] text-zinc-400 mt-0.5">
            {stats.totalUnits.toLocaleString()} units planned
          </div>
        </div>

        <div className="p-3 rounded-xl bg-[var(--panel)] border border-[var(--steel-line)] flex flex-col justify-between">
          <div className="text-[10px] uppercase text-[var(--text-dim)] flex items-center gap-1.5">
            <Scale size={12} className="text-sky-400" />
            <span>Customer Steel (Khari)</span>
          </div>
          <div className="text-xl font-bold text-sky-300 mt-1 font-mono">
            {stats.totalCustomerSteelSaved.toLocaleString()}{' '}
            <span className="text-xs text-zinc-400 font-normal">kg saved</span>
          </div>
          <div className="text-[10px] text-zinc-400 mt-0.5">Customer-provided pipe</div>
        </div>

        <div className="p-3 rounded-xl bg-[var(--panel)] border border-[var(--steel-line)] flex flex-col justify-between">
          <div className="text-[10px] uppercase text-[var(--text-dim)] flex items-center gap-1.5">
            <Wrench size={12} className="text-emerald-400" />
            <span>Avg. Production Cost</span>
          </div>
          <div className="text-xl font-bold text-emerald-300 mt-1 font-mono">
            Rs {stats.avgProductionCost.toFixed(1)}{' '}
            <span className="text-xs text-zinc-400 font-normal">/pc</span>
          </div>
          <div className="text-[10px] text-zinc-400 mt-0.5">Materials + Labour + OH</div>
        </div>

        <div className="p-3 rounded-xl bg-[var(--panel)] border border-[var(--steel-line)] flex flex-col justify-between">
          <div className="text-[10px] uppercase text-[var(--text-dim)] flex items-center gap-1.5">
            <Percent size={12} className="text-[var(--yellow)]" />
            <span>Avg. Profit Margin</span>
          </div>
          <div className="text-xl font-bold text-[var(--yellow)] mt-1 font-mono">
            +{stats.avgProfitMargin.toFixed(1)}%
          </div>
          <div className="text-[10px] text-zinc-400 mt-0.5">Unit profit margin</div>
        </div>

        <div className="p-3 rounded-xl bg-amber-500/10 border border-amber-500/30 flex flex-col justify-between col-span-2 sm:col-span-1">
          <div className="text-[10px] uppercase text-amber-300 font-bold flex items-center gap-1.5">
            <Sparkles size={12} />
            <span>Job Costing Actions</span>
          </div>
          <button
            type="button"
            onClick={() => handleOpenNewProject('falcon_standard')}
            className="w-full mt-2 py-1.5 px-2 rounded-lg bg-amber-500 hover:bg-amber-400 text-black text-xs font-bold uppercase transition flex items-center justify-center gap-1.5 cursor-pointer shadow-sm active:scale-95"
          >
            <Plus size={13} strokeWidth={2.5} />
            <span>New Cost Sheet</span>
          </button>
        </div>
      </div>

      {/* Filter and Action Bar */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 p-3 rounded-xl bg-[var(--panel-raised)] border border-[var(--steel-line)]">
        <div className="flex items-center gap-2 flex-1">
          <div className="relative flex-1 max-w-xs">
            <Search size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-zinc-400" />
            <input
              type="text"
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              placeholder="Search projects, customers, sizes..."
              className="w-full bg-[var(--panel)] border border-[var(--steel-line)] rounded-lg pl-8 pr-3 py-1.5 text-xs text-[var(--text)] outline-none focus:border-amber-400"
            />
          </div>

          {/* Target Type Filter */}
          <div className="flex rounded-lg border border-[var(--steel-line)] overflow-hidden text-xs">
            <button
              type="button"
              onClick={() => setTargetFilter('all')}
              className={`px-2.5 py-1 text-[11px] font-semibold transition ${
                targetFilter === 'all'
                  ? 'bg-amber-500 text-black'
                  : 'bg-[var(--panel)] text-[var(--text-dim)] hover:text-white'
              }`}
            >
              All
            </button>
            <button
              type="button"
              onClick={() => setTargetFilter('factory')}
              className={`px-2.5 py-1 text-[11px] font-semibold transition ${
                targetFilter === 'factory'
                  ? 'bg-amber-500 text-black'
                  : 'bg-[var(--panel)] text-[var(--text-dim)] hover:text-white'
              }`}
            >
              Factories
            </button>
            <button
              type="button"
              onClick={() => setTargetFilter('customer')}
              className={`px-2.5 py-1 text-[11px] font-semibold transition ${
                targetFilter === 'customer'
                  ? 'bg-amber-500 text-black'
                  : 'bg-[var(--panel)] text-[var(--text-dim)] hover:text-white'
              }`}
            >
              Customers (Khari)
            </button>
          </div>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          <button
            type="button"
            onClick={() => handleOpenNewProject('customer_khari')}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-sky-500/15 border border-sky-500/30 text-sky-300 hover:bg-sky-500/25 text-xs font-bold uppercase transition cursor-pointer"
            title="Create a project where customer provides their own raw steel pipe"
          >
            <Scale size={13} />
            <span>+ Khari Job-Work</span>
          </button>
          <button
            type="button"
            onClick={() => handleOpenNewProject('falcon_standard')}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-emerald-500 hover:bg-emerald-400 text-black text-xs font-bold uppercase transition shadow cursor-pointer active:scale-95"
            title="Create a standard production project with full Falcon raw material and labour tracking"
          >
            <Plus size={14} strokeWidth={2.5} />
            <span>+ Project Cost Sheet</span>
          </button>
        </div>
      </div>

      {/* Projects List */}
      {filteredProjects.length === 0 ? (
        <div className="p-8 text-center bg-[var(--panel)] border border-dashed border-[var(--steel-line)] rounded-2xl space-y-3">
          <Briefcase size={36} className="mx-auto text-zinc-500" />
          <h4 className="text-sm font-bold text-[var(--text)]">No project cost sheets found</h4>
          <p className="text-xs text-[var(--text-dim)] max-w-md mx-auto">
            Create granular production cost estimates tracking individual labour operations (cutting,
            punching, lathe, coating) and separate customer-provided raw steel from factory materials.
          </p>
          <div className="flex justify-center gap-2 pt-2">
            <button
              type="button"
              onClick={() => handleOpenNewProject('falcon_standard')}
              className="px-4 py-2 rounded-xl bg-amber-500 text-black font-bold text-xs uppercase"
            >
              + Create First Cost Sheet
            </button>
          </div>
        </div>
      ) : (
        <div className="space-y-3">
          {filteredProjects.map(project => {
            const isExpanded = expandedProjectId === project.id;
            const isCustomerKhari =
              project.targetType === 'customer' ||
              project.materialEstimates.some(m => m.sourceType === 'customer_provided');

            // Breakdown percentages for progress bar
            const totalCost = project.totalProductionCost || 1;
            const matPct = Math.round(((project.totalMaterialCost || 0) / totalCost) * 100);
            const labPct = Math.round(((project.totalLabourCost || 0) / totalCost) * 100);
            const ovhPct = Math.max(0, 100 - matPct - labPct);

            return (
              <div
                key={project.id}
                className="bg-[var(--panel)] border border-[var(--steel-line)] hover:border-amber-400/50 rounded-2xl p-4 transition shadow-sm space-y-3"
              >
                {/* Project Header */}
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-[var(--steel-line)] pb-3">
                  <div>
                    <div className="flex items-center gap-2 flex-wrap">
                      <h4 className="font-serif font-black text-base text-[var(--text)]">
                        {project.projectName}
                      </h4>
                      <span
                        className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider ${
                          project.targetType === 'customer'
                            ? 'bg-sky-500/20 text-sky-300 border border-sky-500/40'
                            : 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40'
                        }`}
                      >
                        {project.targetType === 'customer' ? 'Customer Job-Work' : 'Factory Order'}
                      </span>
                      <span
                        className={`px-2 py-0.5 rounded text-[10px] font-mono font-bold ${
                          project.status === 'completed'
                            ? 'bg-emerald-500/15 text-emerald-400'
                            : project.status === 'in_progress'
                            ? 'bg-amber-500/15 text-amber-300'
                            : 'bg-zinc-800 text-zinc-400'
                        }`}
                      >
                        {project.status.toUpperCase()}
                      </span>
                    </div>

                    <div className="flex items-center gap-2 text-xs text-[var(--text-dim)] mt-1 flex-wrap font-mono">
                      <span className="font-bold text-white flex items-center gap-1">
                        <Building size={12} className="text-zinc-400" />
                        {project.targetPartyName}
                      </span>
                      <span>·</span>
                      <span className="text-amber-400 font-bold">
                        {project.rodSize} Rod ({project.gauge || '16G'}, {project.diameter || '3/4"'})
                      </span>
                      <span>·</span>
                      <span>Batch: {project.batchQuantity.toLocaleString()} pcs</span>
                      <span>·</span>
                      <span>{project.date}</span>
                    </div>
                  </div>

                  {/* Actions */}
                  <div className="flex items-center gap-1.5 flex-wrap">
                    <button
                      type="button"
                      onClick={() => setPrintProject(project)}
                      className="px-2.5 py-1 rounded-lg bg-[var(--panel-raised)] border border-[var(--steel-line)] hover:border-amber-400 text-xs font-semibold text-zinc-300 hover:text-white transition flex items-center gap-1 cursor-pointer"
                      title="View & Print Workshop Cost Sheet"
                    >
                      <Printer size={13} />
                      <span>Print Sheet</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => handleDuplicateProject(project)}
                      className="p-1.5 rounded-lg bg-[var(--panel-raised)] border border-[var(--steel-line)] hover:border-amber-400 text-zinc-300 hover:text-white transition cursor-pointer"
                      title="Duplicate project"
                    >
                      <Copy size={13} />
                    </button>
                    <button
                      type="button"
                      onClick={() => handleEditProject(project)}
                      className="p-1.5 rounded-lg bg-[var(--panel-raised)] border border-[var(--steel-line)] hover:border-amber-400 text-amber-400 transition cursor-pointer"
                      title="Edit project cost calculation"
                    >
                      <Edit3 size={13} />
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        if (confirm(`Delete project cost sheet "${project.projectName}"?`)) {
                          onDeleteProject(project.id);
                        }
                      }}
                      className="p-1.5 rounded-lg bg-[var(--panel-raised)] border border-[var(--steel-line)] hover:border-red-500 text-red-400 transition cursor-pointer"
                      title="Delete project"
                    >
                      <Trash2 size={13} />
                    </button>
                  </div>
                </div>

                {/* Granular Cost Economics Matrix */}
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 pt-1 text-xs font-mono">
                  {/* Raw Material Cost */}
                  <div className="p-2.5 rounded-xl bg-[var(--panel-raised)] border border-[var(--steel-line)]">
                    <div className="text-[10px] uppercase text-zinc-400 flex items-center justify-between">
                      <span>Raw Materials / Unit</span>
                      <Boxes size={11} className="text-emerald-400" />
                    </div>
                    <div className="text-base font-bold text-emerald-300 mt-1">
                      Rs {project.materialCostPerUnit.toFixed(1)}
                    </div>
                    <div className="text-[10px] text-zinc-400 mt-0.5 truncate">
                      Total: {fmt(project.totalMaterialCost)}
                    </div>
                    {project.customerSuppliedWeightSavedKg && project.customerSuppliedWeightSavedKg > 0 ? (
                      <div className="text-[10px] text-sky-400 font-bold mt-1">
                        + {project.customerSuppliedWeightSavedKg} kg Customer Steel
                      </div>
                    ) : null}
                  </div>

                  {/* Labour Cost */}
                  <div className="p-2.5 rounded-xl bg-[var(--panel-raised)] border border-[var(--steel-line)]">
                    <div className="text-[10px] uppercase text-zinc-400 flex items-center justify-between">
                      <span>Direct Labour / Unit</span>
                      <Wrench size={11} className="text-amber-400" />
                    </div>
                    <div className="text-base font-bold text-amber-300 mt-1">
                      Rs {project.labourCostPerUnit.toFixed(1)}
                    </div>
                    <div className="text-[10px] text-zinc-400 mt-0.5">
                      {project.labourOperations.length} ops · Total: {fmt(project.totalLabourCost)}
                    </div>
                  </div>

                  {/* Total Unit Production Cost */}
                  <div className="p-2.5 rounded-xl bg-amber-500/10 border border-amber-500/40">
                    <div className="text-[10px] uppercase text-amber-300 font-bold flex items-center justify-between">
                      <span>Production Cost (Unit)</span>
                      <Calculator size={11} />
                    </div>
                    <div className="text-base font-black text-amber-400 mt-1">
                      Rs {project.productionCostPerUnit.toFixed(1)}
                    </div>
                    <div className="text-[10px] text-zinc-400 mt-0.5">
                      Batch Total: {fmt(project.totalProductionCost)}
                    </div>
                  </div>

                  {/* Quoted Price & Profit Margin */}
                  <div className="p-2.5 rounded-xl bg-[var(--panel-raised)] border border-[var(--steel-line)]">
                    <div className="text-[10px] uppercase text-zinc-400 flex items-center justify-between">
                      <span>Selling Price & Margin</span>
                      <Percent size={11} className="text-emerald-400" />
                    </div>
                    <div className="text-base font-bold text-white mt-1">
                      Rs {project.quotedPricePerUnit.toFixed(0)}{' '}
                      <span className="text-xs text-emerald-400 font-normal">
                        (+{project.profitMarginPercent}%)
                      </span>
                    </div>
                    <div className="text-[10px] text-emerald-400 font-bold mt-0.5">
                      Net Profit: {fmt(project.expectedProfitTotal)}
                    </div>
                  </div>
                </div>

                {/* Proportional Cost Breakdown Bar */}
                <div className="space-y-1">
                  <div className="flex items-center justify-between text-[10px] text-zinc-400 font-mono">
                    <span>Cost Distribution</span>
                    <span>
                      Materials {matPct}% · Labour {labPct}% · Overhead {ovhPct}%
                    </span>
                  </div>
                  <div className="h-2 w-full rounded-full bg-zinc-800 overflow-hidden flex">
                    <div
                      style={{ width: `${matPct}%` }}
                      className="bg-emerald-500 h-full"
                      title={`Material Cost: ${matPct}%`}
                    />
                    <div
                      style={{ width: `${labPct}%` }}
                      className="bg-amber-500 h-full"
                      title={`Labour Cost: ${labPct}%`}
                    />
                    <div
                      style={{ width: `${ovhPct}%` }}
                      className="bg-zinc-500 h-full"
                      title={`Overhead Cost: ${ovhPct}%`}
                    />
                  </div>
                </div>

                {/* Toggle Breakdown Details */}
                <button
                  type="button"
                  onClick={() => setExpandedProjectId(isExpanded ? null : project.id)}
                  className="w-full py-1.5 px-3 rounded-xl bg-[var(--panel-raised)] hover:bg-zinc-800 border border-[var(--steel-line)] text-xs text-zinc-300 hover:text-white transition flex items-center justify-between cursor-pointer"
                >
                  <span className="font-semibold flex items-center gap-1.5">
                    <Layers size={13} className="text-amber-400" />
                    <span>
                      {isExpanded ? 'Hide' : 'View'} Granular Breakdown ({project.materialEstimates.length}{' '}
                      materials · {project.labourOperations.length} labour ops)
                    </span>
                  </span>
                  {isExpanded ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
                </button>

                {/* Expanded Details Drawer */}
                {isExpanded && (
                  <div className="p-3 sm:p-4 rounded-xl bg-[var(--panel-raised)]/70 border border-[var(--steel-line)] space-y-4 animate-in fade-in duration-150 text-xs">
                    {/* Materials Table */}
                    <div>
                      <h5 className="font-bold uppercase text-[10px] text-emerald-400 mb-2 flex items-center gap-1.5">
                        <Boxes size={13} />
                        <span>Allocated Raw Materials (Factory vs Customer Khari)</span>
                      </h5>
                      <div className="overflow-x-auto border border-[var(--steel-line)] rounded-lg">
                        <table className="w-full text-left text-xs border-collapse">
                          <thead className="bg-zinc-900 text-zinc-400 text-[10px] uppercase border-b border-[var(--steel-line)]">
                            <tr>
                              <th className="p-2">Material Specification</th>
                              <th className="p-2">Source Type</th>
                              <th className="p-2">Consumption / Unit</th>
                              <th className="p-2 text-right">Unit Rate (Rs)</th>
                              <th className="p-2 text-right">Total Quantity</th>
                              <th className="p-2 text-right">Total Billed Cost</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-[var(--steel-line)]">
                            {project.materialEstimates.map(m => (
                              <tr key={m.id} className="hover:bg-zinc-900/40 font-mono">
                                <td className="p-2 font-sans font-semibold text-white">
                                  {m.materialName}
                                  {m.notes && (
                                    <div className="text-[10px] text-zinc-400 font-normal">{m.notes}</div>
                                  )}
                                </td>
                                <td className="p-2">
                                  <span
                                    className={`px-1.5 py-0.5 rounded text-[9px] font-bold uppercase ${
                                      m.sourceType === 'customer_provided'
                                        ? 'bg-sky-500/20 text-sky-300 border border-sky-500/40'
                                        : 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40'
                                    }`}
                                  >
                                    {m.sourceType === 'customer_provided'
                                      ? 'Customer Khari (Free)'
                                      : 'Factory Supplied'}
                                  </span>
                                </td>
                                <td className="p-2">
                                  {m.consumptionPerUnit} {m.unit}
                                </td>
                                <td className="p-2 text-right">
                                  {m.sourceType === 'customer_provided' ? 'Rs 0' : `Rs ${m.unitRate}`}
                                </td>
                                <td className="p-2 text-right font-bold text-zinc-300">
                                  {m.totalQuantityOrWeight.toLocaleString()} {m.unit}
                                </td>
                                <td className="p-2 text-right font-bold text-emerald-400">
                                  {m.sourceType === 'customer_provided' ? 'Rs 0' : fmt(m.totalCost)}
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </div>

                    {/* Labour Operations Table */}
                    <div>
                      <h5 className="font-bold uppercase text-[10px] text-amber-400 mb-2 flex items-center gap-1.5">
                        <Wrench size={13} />
                        <span>Individual Labour Operations & Station Costs</span>
                      </h5>
                      <div className="overflow-x-auto border border-[var(--steel-line)] rounded-lg">
                        <table className="w-full text-left text-xs border-collapse">
                          <thead className="bg-zinc-900 text-zinc-400 text-[10px] uppercase border-b border-[var(--steel-line)]">
                            <tr>
                              <th className="p-2">Operation Name</th>
                              <th className="p-2">Worker / Station</th>
                              <th className="p-2 text-right">Piece Rate (Rs/pc)</th>
                              <th className="p-2 text-right">Total Batch Cost</th>
                              <th className="p-2 text-center">Status</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-[var(--steel-line)]">
                            {project.labourOperations.map(l => (
                              <tr key={l.id} className="hover:bg-zinc-900/40 font-mono">
                                <td className="p-2 font-sans font-semibold text-white">{l.name}</td>
                                <td className="p-2 text-zinc-300 flex items-center gap-1">
                                  <UserCheck size={11} className="text-zinc-500" />
                                  <span>{l.workerName || 'Assigned Staff'}</span>
                                </td>
                                <td className="p-2 text-right font-bold text-amber-300">
                                  Rs {l.ratePerUnit.toFixed(2)}
                                </td>
                                <td className="p-2 text-right font-bold text-white">
                                  {fmt(l.totalCost)}
                                </td>
                                <td className="p-2 text-center">
                                  <span
                                    className={`px-1.5 py-0.2 rounded text-[9px] font-bold ${
                                      l.isCompleted
                                        ? 'bg-emerald-500/20 text-emerald-300'
                                        : 'bg-zinc-800 text-zinc-400'
                                    }`}
                                  >
                                    {l.isCompleted ? 'Done' : 'Pending'}
                                  </span>
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* MODAL: Project Cost Sheet Editor */}
      {isModalOpen && (
        <div
          role="dialog"
          aria-modal="true"
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/85 backdrop-blur-sm p-2 sm:p-4 font-mono animate-in fade-in duration-150"
        >
          <div className="w-full max-w-4xl max-w-full bg-[var(--panel)] border border-amber-500/50 rounded-2xl p-4 sm:p-6 shadow-2xl max-h-[94vh] flex flex-col overflow-y-auto space-y-4">
            {/* Header */}
            <div className="flex items-start justify-between border-b border-[var(--steel-line)] pb-3">
              <div className="flex items-center gap-2.5">
                <div className="p-2 rounded-xl bg-amber-500/20 text-amber-400 border border-amber-500/40">
                  <Calculator size={20} />
                </div>
                <div>
                  <h3 className="font-serif font-black text-base sm:text-lg text-[var(--text)]">
                    {editingProject ? 'Edit Project Cost Sheet' : 'New Customer / Factory Project Cost Sheet'}
                  </h3>
                  <p className="text-xs text-amber-300/80 font-sans">
                    Granular production cost calculation, separate customer raw materials, and individual labour rates
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setIsModalOpen(false)}
                className="p-1 rounded-lg text-zinc-400 hover:text-white"
              >
                <X size={18} />
              </button>
            </div>

            <form onSubmit={handleSaveForm} className="space-y-4 text-xs">
              {/* Presets Bar */}
              <div className="p-2.5 rounded-xl bg-[var(--panel-raised)] border border-[var(--steel-line)] flex items-center justify-between flex-wrap gap-2">
                <span className="text-[10px] uppercase text-zinc-400 font-bold flex items-center gap-1">
                  <Sparkles size={12} className="text-amber-400" />
                  <span>Gujrat Fan Rod Presets:</span>
                </span>
                <div className="flex gap-1.5 flex-wrap">
                  <button
                    type="button"
                    onClick={() => handleOpenNewProject('falcon_standard')}
                    className="px-2.5 py-1 rounded bg-emerald-500/20 border border-emerald-500/40 text-emerald-300 text-[10px] font-bold"
                  >
                    18" Standard Deluxe (Falcon Steel)
                  </button>
                  <button
                    type="button"
                    onClick={() => handleOpenNewProject('customer_khari')}
                    className="px-2.5 py-1 rounded bg-sky-500/20 border border-sky-500/40 text-sky-300 text-[10px] font-bold"
                  >
                    24" Heavy Job-Work (Customer Pipe Khari)
                  </button>
                </div>
              </div>

              {/* Basic Project & Target Party Setup */}
              <div className="p-3 rounded-xl bg-[var(--panel-raised)] border border-[var(--steel-line)] space-y-3">
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <div>
                    <label className="text-[10px] uppercase text-zinc-400 font-bold block mb-1">
                      Project / Batch Title <span className="text-red-400">*</span>
                    </label>
                    <input
                      type="text"
                      required
                      value={formName}
                      onChange={e => setFormName(e.target.value)}
                      placeholder="e.g. Royal Deluxe 18-inch Batch"
                      className="w-full bg-[var(--panel)] border border-[var(--steel-line)] focus:border-amber-400 rounded-xl px-3 py-2 text-xs text-white outline-none"
                    />
                  </div>

                  <div>
                    <label className="text-[10px] uppercase text-zinc-400 font-bold block mb-1">
                      Target Project Type
                    </label>
                    <select
                      value={formTargetType}
                      onChange={e => setFormTargetType(e.target.value as any)}
                      className="w-full bg-[var(--panel)] border border-[var(--steel-line)] focus:border-amber-400 rounded-xl px-3 py-2 text-xs text-white outline-none"
                    >
                      <option value="factory">Factory Workshop Account</option>
                      <option value="customer">Customer / Job-Work Party</option>
                    </select>
                  </div>

                  <div>
                    <label className="text-[10px] uppercase text-zinc-400 font-bold block mb-1">
                      Customer / Factory Name <span className="text-red-400">*</span>
                    </label>
                    <div className="relative">
                      <input
                        type="text"
                        required
                        value={formTargetPartyName}
                        onChange={e => setFormTargetPartyName(e.target.value)}
                        placeholder="e.g. Al-Madina Fan Workshop or Super Asia"
                        list="party-suggestions"
                        className="w-full bg-[var(--panel)] border border-[var(--steel-line)] focus:border-amber-400 rounded-xl px-3 py-2 text-xs text-white outline-none"
                      />
                      <datalist id="party-suggestions">
                        {factories.map(f => (
                          <option key={f.name} value={f.name} />
                        ))}
                        {customLedgers.map(c => (
                          <option key={c.name} value={c.name} />
                        ))}
                      </datalist>
                    </div>
                  </div>
                </div>

                {/* Rod Specifications & Batch Quantity */}
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 pt-1">
                  <div>
                    <label className="text-[10px] uppercase text-zinc-400 font-bold block mb-1">
                      Rod Length / Size
                    </label>
                    <select
                      value={formRodSize}
                      onChange={e => {
                        const newSize = e.target.value;
                        setFormRodSize(newSize);
                        if (STANDARD_SIZES_WEIGHTS[newSize]) {
                          // Auto update pipe weight in materials if present
                          const stdW = STANDARD_SIZES_WEIGHTS[newSize];
                          setFormMaterials(prev =>
                            prev.map(m =>
                              m.materialName.toLowerCase().includes('pipe')
                                ? { ...m, consumptionPerUnit: stdW }
                                : m
                            )
                          );
                        }
                      }}
                      className="w-full bg-[var(--panel)] border border-[var(--steel-line)] focus:border-amber-400 rounded-xl px-2.5 py-1.5 text-xs text-white outline-none"
                    >
                      <option value="6&quot;">6 inch</option>
                      <option value="12&quot;">12 inch</option>
                      <option value="18&quot;">18 inch</option>
                      <option value="24&quot;">24 inch</option>
                      <option value="30&quot;">30 inch</option>
                      <option value="36&quot;">36 inch</option>
                      <option value="48&quot;">48 inch</option>
                      <option value="60&quot;">60 inch</option>
                      <option value="Custom">Custom Size</option>
                    </select>
                  </div>

                  <div>
                    <label className="text-[10px] uppercase text-zinc-400 font-bold block mb-1">
                      Steel Gauge
                    </label>
                    <select
                      value={formGauge}
                      onChange={e => setFormGauge(e.target.value)}
                      className="w-full bg-[var(--panel)] border border-[var(--steel-line)] focus:border-amber-400 rounded-xl px-2.5 py-1.5 text-xs text-white outline-none"
                    >
                      <option value="16 Gauge">16 Gauge (Standard)</option>
                      <option value="14 Gauge">14 Gauge (Heavy)</option>
                      <option value="18 Gauge">18 Gauge (Light)</option>
                      <option value="20 Gauge">20 Gauge</option>
                    </select>
                  </div>

                  <div>
                    <label className="text-[10px] uppercase text-zinc-400 font-bold block mb-1">
                      Batch Quantity (pcs)
                    </label>
                    <input
                      type="number"
                      required
                      min="1"
                      value={formBatchQty}
                      onChange={e => setFormBatchQty(e.target.value)}
                      placeholder="e.g. 500"
                      className="w-full bg-[var(--panel)] border border-amber-500/60 focus:border-amber-400 rounded-xl px-3 py-1.5 text-xs text-amber-300 font-bold font-mono outline-none"
                    />
                  </div>

                  <div>
                    <label className="text-[10px] uppercase text-zinc-400 font-bold block mb-1">
                      Project Status
                    </label>
                    <select
                      value={formStatus}
                      onChange={e => setFormStatus(e.target.value as any)}
                      className="w-full bg-[var(--panel)] border border-[var(--steel-line)] focus:border-amber-400 rounded-xl px-2.5 py-1.5 text-xs text-white outline-none"
                    >
                      <option value="draft">Draft (Planning)</option>
                      <option value="in_progress">In Progress (Shopfloor)</option>
                      <option value="completed">Completed</option>
                      <option value="billed">Billed & Dispatched</option>
                    </select>
                  </div>
                </div>
              </div>

              {/* SECTION 1: Granular Separate Raw Material Cost Estimates */}
              <div className="p-3 sm:p-4 rounded-xl bg-[var(--panel-raised)] border border-emerald-500/40 space-y-3">
                <div className="flex items-center justify-between flex-wrap gap-2">
                  <div className="flex items-center gap-2">
                    <div className="p-1.5 rounded-lg bg-emerald-500/20 text-emerald-400">
                      <Boxes size={15} />
                    </div>
                    <div>
                      <h4 className="font-bold uppercase text-xs text-emerald-300">
                        1. Raw Material Estimates (Separate Factory vs Customer Khari)
                      </h4>
                      <p className="text-[10px] text-zinc-400 font-sans">
                        Customer-provided steel is costed at Rs 0 to Falcon while tracking exact consumption
                      </p>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={handleAddMaterialRow}
                    className="px-2.5 py-1 rounded-lg bg-emerald-500/20 hover:bg-emerald-500/30 text-emerald-300 border border-emerald-500/40 text-[11px] font-bold flex items-center gap-1 cursor-pointer"
                  >
                    <Plus size={12} />
                    <span>+ Add Material Item</span>
                  </button>
                </div>

                {/* Materials List */}
                <div className="space-y-2">
                  {formMaterials.map((mat, idx) => {
                    const isCust = mat.sourceType === 'customer_provided';
                    return (
                      <div
                        key={mat.id}
                        className="p-2.5 rounded-xl bg-[var(--panel)] border border-[var(--steel-line)] grid grid-cols-1 sm:grid-cols-12 gap-2 items-center"
                      >
                        <div className="sm:col-span-4">
                          <label className="text-[9px] uppercase text-zinc-500 block">Material Name</label>
                          <input
                            type="text"
                            value={mat.materialName}
                            onChange={e => {
                              const val = e.target.value;
                              setFormMaterials(prev =>
                                prev.map(m => (m.id === mat.id ? { ...m, materialName: val } : m))
                              );
                            }}
                            className="w-full bg-[var(--panel-raised)] border border-[var(--steel-line)] rounded px-2 py-1 text-xs text-white outline-none"
                          />
                        </div>

                        <div className="sm:col-span-2">
                          <label className="text-[9px] uppercase text-zinc-500 block">Source</label>
                          <select
                            value={mat.sourceType}
                            onChange={e => {
                              const val = e.target.value as any;
                              setFormMaterials(prev =>
                                prev.map(m =>
                                  m.id === mat.id
                                    ? {
                                        ...m,
                                        sourceType: val,
                                        unitRate: val === 'customer_provided' ? 0 : m.unitRate
                                      }
                                    : m
                                )
                              );
                            }}
                            className={`w-full border rounded px-1.5 py-1 text-[11px] font-bold outline-none ${
                              isCust
                                ? 'bg-sky-950/40 text-sky-300 border-sky-500/50'
                                : 'bg-emerald-950/40 text-emerald-300 border-emerald-500/50'
                            }`}
                          >
                            <option value="factory_supplied">Falcon Factory</option>
                            <option value="customer_provided">Customer Khari (Free)</option>
                          </select>
                        </div>

                        <div className="sm:col-span-2">
                          <label className="text-[9px] uppercase text-zinc-500 block">Per Unit Req.</label>
                          <div className="flex gap-1">
                            <input
                              type="number"
                              step="any"
                              value={mat.consumptionPerUnit}
                              onChange={e => {
                                const val = parseFloat(e.target.value) || 0;
                                setFormMaterials(prev =>
                                  prev.map(m =>
                                    m.id === mat.id ? { ...m, consumptionPerUnit: val } : m
                                  )
                                );
                              }}
                              className="w-full bg-[var(--panel-raised)] border border-[var(--steel-line)] rounded px-2 py-1 text-xs text-white font-mono outline-none"
                            />
                            <input
                              type="text"
                              value={mat.unit}
                              onChange={e => {
                                const val = e.target.value;
                                setFormMaterials(prev =>
                                  prev.map(m => (m.id === mat.id ? { ...m, unit: val } : m))
                                );
                              }}
                              className="w-12 bg-[var(--panel-raised)] border border-[var(--steel-line)] rounded px-1 py-1 text-[10px] text-zinc-300 font-mono outline-none text-center"
                            />
                          </div>
                        </div>

                        <div className="sm:col-span-2">
                          <label className="text-[9px] uppercase text-zinc-500 block">Unit Rate (Rs)</label>
                          <input
                            type="number"
                            step="any"
                            disabled={isCust}
                            value={isCust ? '0' : mat.unitRate}
                            onChange={e => {
                              const val = parseFloat(e.target.value) || 0;
                              setFormMaterials(prev =>
                                prev.map(m => (m.id === mat.id ? { ...m, unitRate: val } : m))
                              );
                            }}
                            className={`w-full border rounded px-2 py-1 text-xs font-mono outline-none ${
                              isCust
                                ? 'bg-zinc-800 text-zinc-500 border-zinc-700'
                                : 'bg-[var(--panel-raised)] text-emerald-300 border-[var(--steel-line)]'
                            }`}
                          />
                        </div>

                        <div className="sm:col-span-2 flex items-center justify-between gap-1">
                          <div>
                            <span className="text-[9px] uppercase text-zinc-500 block">Line Total</span>
                            <span className="text-xs font-bold text-white font-mono">
                              {isCust ? 'Rs 0' : fmt(Math.round(mat.consumptionPerUnit * parsedBatchQty * mat.unitRate))}
                            </span>
                          </div>
                          <button
                            type="button"
                            onClick={() => handleRemoveMaterialRow(mat.id)}
                            className="p-1 rounded text-zinc-500 hover:text-red-400"
                            title="Remove"
                          >
                            <Trash2 size={13} />
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>

                {/* Material Subtotal Bar */}
                <div className="flex items-center justify-between p-2.5 rounded-xl bg-zinc-900 border border-[var(--steel-line)] font-mono text-xs">
                  <div>
                    <span className="text-zinc-400">Total Factory Material Cost:</span>{' '}
                    <span className="font-bold text-emerald-400">
                      {fmt(computedMaterials.totalMaterialCost)} (Rs {computedMaterials.materialCostPerUnit.toFixed(1)}/pc)
                    </span>
                  </div>
                  {computedMaterials.customerSteelWeightSavedKg > 0 && (
                    <div className="text-sky-300 text-[11px] font-bold">
                      Customer Steel Consumed: {computedMaterials.customerSteelWeightSavedKg.toLocaleString()} kg
                    </div>
                  )}
                </div>
              </div>

              {/* SECTION 2: Individual Labour Cost Tracking */}
              <div className="p-3 sm:p-4 rounded-xl bg-[var(--panel-raised)] border border-amber-500/40 space-y-3">
                <div className="flex items-center justify-between flex-wrap gap-2">
                  <div className="flex items-center gap-2">
                    <div className="p-1.5 rounded-lg bg-amber-500/20 text-amber-400">
                      <Wrench size={15} />
                    </div>
                    <div>
                      <h4 className="font-bold uppercase text-xs text-amber-300">
                        2. Individual Direct Labour Tracking (Operation-by-Operation)
                      </h4>
                      <p className="text-[10px] text-zinc-400 font-sans">
                        Piece-rate labour costs per unit for lathe turning, punching, threading, coating & packing
                      </p>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={handleAddLabourRow}
                    className="px-2.5 py-1 rounded-lg bg-amber-500/20 hover:bg-amber-500/30 text-amber-300 border border-amber-500/40 text-[11px] font-bold flex items-center gap-1 cursor-pointer"
                  >
                    <Plus size={12} />
                    <span>+ Add Labour Op</span>
                  </button>
                </div>

                {/* Labour Operations List */}
                <div className="space-y-2">
                  {formLabour.map((op, idx) => (
                    <div
                      key={op.id}
                      className="p-2.5 rounded-xl bg-[var(--panel)] border border-[var(--steel-line)] grid grid-cols-1 sm:grid-cols-12 gap-2 items-center"
                    >
                      <div className="sm:col-span-5">
                        <label className="text-[9px] uppercase text-zinc-500 block">Operation Name</label>
                        <input
                          type="text"
                          value={op.name}
                          onChange={e => {
                            const val = e.target.value;
                            setFormLabour(prev =>
                              prev.map(l => (l.id === op.id ? { ...l, name: val } : l))
                            );
                          }}
                          className="w-full bg-[var(--panel-raised)] border border-[var(--steel-line)] rounded px-2 py-1 text-xs text-white outline-none"
                        />
                      </div>

                      <div className="sm:col-span-3">
                        <label className="text-[9px] uppercase text-zinc-500 block">Assigned Worker / Station</label>
                        <input
                          type="text"
                          value={op.workerName || ''}
                          onChange={e => {
                            const val = e.target.value;
                            setFormLabour(prev =>
                              prev.map(l => (l.id === op.id ? { ...l, workerName: val } : l))
                            );
                          }}
                          placeholder="Worker name"
                          list={`worker-list-${idx}`}
                          className="w-full bg-[var(--panel-raised)] border border-[var(--steel-line)] rounded px-2 py-1 text-xs text-zinc-300 outline-none"
                        />
                        <datalist id={`worker-list-${idx}`}>
                          {workers.map(w => (
                            <option key={w.name} value={w.name} />
                          ))}
                        </datalist>
                      </div>

                      <div className="sm:col-span-2">
                        <label className="text-[9px] uppercase text-zinc-500 block">Rate / Rod (Rs)</label>
                        <input
                          type="number"
                          step="0.25"
                          min="0"
                          value={op.ratePerUnit}
                          onChange={e => {
                            const val = parseFloat(e.target.value) || 0;
                            setFormLabour(prev =>
                              prev.map(l => (l.id === op.id ? { ...l, ratePerUnit: val } : l))
                            );
                          }}
                          className="w-full bg-[var(--panel-raised)] border border-amber-500/50 rounded px-2 py-1 text-xs text-amber-300 font-bold font-mono outline-none"
                        />
                      </div>

                      <div className="sm:col-span-2 flex items-center justify-between gap-1">
                        <div>
                          <span className="text-[9px] uppercase text-zinc-500 block">Op Total</span>
                          <span className="text-xs font-bold text-white font-mono">
                            {fmt(Math.round(op.ratePerUnit * parsedBatchQty))}
                          </span>
                        </div>
                        <button
                          type="button"
                          onClick={() => handleRemoveLabourRow(op.id)}
                          className="p-1 rounded text-zinc-500 hover:text-red-400"
                          title="Remove"
                        >
                          <Trash2 size={13} />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>

                {/* Labour Subtotal Bar */}
                <div className="flex items-center justify-between p-2.5 rounded-xl bg-zinc-900 border border-[var(--steel-line)] font-mono text-xs">
                  <div>
                    <span className="text-zinc-400">Total Direct Labour Cost:</span>{' '}
                    <span className="font-bold text-amber-400">
                      {fmt(computedLabour.totalLabourCost)} (Rs {computedLabour.labourCostPerUnit.toFixed(2)}/pc)
                    </span>
                  </div>
                  <div className="text-zinc-400 text-[11px]">
                    {formLabour.length} operations tracked
                  </div>
                </div>
              </div>

              {/* SECTION 3: Overheads & Selling Price */}
              <div className="p-3 sm:p-4 rounded-xl bg-[var(--panel-raised)] border border-[var(--steel-line)] space-y-3">
                <h4 className="font-bold uppercase text-xs text-zinc-300">
                  3. Workshop Overhead & Quoted Rate (Per Unit)
                </h4>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="text-[10px] uppercase text-zinc-400 font-bold block mb-1">
                      Overhead per Rod (Rs/pc)
                    </label>
                    <input
                      type="number"
                      step="0.5"
                      min="0"
                      value={formOverheadPerUnit}
                      onChange={e => setFormOverheadPerUnit(e.target.value)}
                      placeholder="e.g. 2.50"
                      className="w-full bg-[var(--panel)] border border-[var(--steel-line)] rounded-xl px-3 py-1.5 text-xs text-white font-mono outline-none"
                    />
                    <span className="text-[9px] text-zinc-500 mt-0.5 block">
                      Electricity, lathe cutting tools, drill bits, degreasing chemicals
                    </span>
                  </div>

                  <div>
                    <label className="text-[10px] uppercase text-emerald-400 font-bold block mb-1">
                      Quoted Selling / Billed Rate per Rod (Rs/pc)
                    </label>
                    <input
                      type="number"
                      step="1"
                      min="0"
                      value={formQuotedPrice}
                      onChange={e => setFormQuotedPrice(e.target.value)}
                      placeholder="e.g. 420"
                      className="w-full bg-[var(--panel)] border border-emerald-500/50 rounded-xl px-3 py-1.5 text-xs text-emerald-300 font-bold font-mono outline-none"
                    />
                    <span className="text-[9px] text-zinc-500 mt-0.5 block">
                      Amount charged to customer or factory on dispatch
                    </span>
                  </div>
                </div>
              </div>

              {/* LIVE FINANCIAL RECAP BANNER */}
              <div className="p-4 rounded-xl bg-gradient-to-r from-zinc-900 to-black border border-amber-500/60 space-y-2">
                <div className="text-[10px] uppercase tracking-wider text-amber-400 font-bold flex items-center justify-between">
                  <span>Grand Production Cost & Profitability Summary</span>
                  <span>Batch: {parsedBatchQty.toLocaleString()} units</span>
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs font-mono pt-1">
                  <div>
                    <span className="text-zinc-400 text-[10px] block">Material / pc</span>
                    <span className="text-sm font-bold text-emerald-300">
                      Rs {computedMaterials.materialCostPerUnit.toFixed(1)}
                    </span>
                  </div>
                  <div>
                    <span className="text-zinc-400 text-[10px] block">Labour / pc</span>
                    <span className="text-sm font-bold text-amber-300">
                      Rs {computedLabour.labourCostPerUnit.toFixed(1)}
                    </span>
                  </div>
                  <div>
                    <span className="text-zinc-400 text-[10px] block">Total Cost / pc</span>
                    <span className="text-base font-black text-white">
                      Rs {computedTotals.productionCostPerUnit.toFixed(1)}
                    </span>
                  </div>
                  <div>
                    <span className="text-zinc-400 text-[10px] block">Expected Net Margin</span>
                    <span className="text-base font-black text-emerald-400">
                      +{computedTotals.profitMarginPercent}% ({fmt(computedTotals.expectedProfitTotal)})
                    </span>
                  </div>
                </div>
              </div>

              {/* Notes */}
              <div>
                <label className="text-[10px] uppercase text-zinc-400 font-bold block mb-1">
                  Project Notes & Delivery Instructions
                </label>
                <textarea
                  rows={2}
                  value={formNotes}
                  onChange={e => setFormNotes(e.target.value)}
                  placeholder="Notes on packaging, threading specifications, delivery deadline..."
                  className="w-full bg-[var(--panel-raised)] border border-[var(--steel-line)] rounded-xl p-2.5 text-xs text-white outline-none"
                />
              </div>

              {/* Modal Buttons */}
              <div className="flex items-center justify-end gap-2.5 pt-3 border-t border-[var(--steel-line)]">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="px-4 py-2 rounded-xl border border-[var(--steel-line)] text-xs text-zinc-300 hover:text-white transition"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 rounded-xl bg-amber-500 hover:bg-amber-400 text-black font-bold text-xs uppercase shadow-md transition active:scale-95"
                >
                  Save Project Cost Sheet
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* PRINTABLE COST SHEET MODAL */}
      {printProject && (
        <div
          role="dialog"
          aria-modal="true"
          className="fixed inset-0 z-60 flex items-center justify-center bg-black/90 p-3 sm:p-4 font-mono animate-in fade-in duration-150"
        >
          <div className="w-full max-w-3xl bg-white text-zinc-900 rounded-2xl p-6 shadow-2xl max-h-[92vh] overflow-y-auto space-y-4">
            <div className="flex items-start justify-between border-b pb-3 border-zinc-200">
              <div>
                <h3 className="font-serif font-black text-xl text-black">
                  {companyName || 'Falcon Rod Maker'}
                </h3>
                <p className="text-xs text-zinc-600">
                  Granular Production Cost Sheet & Job-Work Specification
                </p>
                <div className="text-xs font-bold text-amber-700 mt-1">
                  Project: {printProject.projectName} · Party: {printProject.targetPartyName}
                </div>
              </div>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => window.print()}
                  className="px-3 py-1.5 rounded-lg bg-zinc-900 text-white font-bold text-xs flex items-center gap-1.5 cursor-pointer"
                >
                  <Printer size={13} />
                  <span>Print</span>
                </button>
                <button
                  type="button"
                  onClick={() => setPrintProject(null)}
                  className="p-1 rounded text-zinc-500 hover:text-black"
                >
                  <X size={18} />
                </button>
              </div>
            </div>

            {/* Print Summary */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs border p-3 rounded-xl bg-zinc-50">
              <div>
                <span className="text-zinc-500 block text-[10px] uppercase">Rod Size & Gauge</span>
                <span className="font-bold text-zinc-900">
                  {printProject.rodSize} ({printProject.gauge || '16G'})
                </span>
              </div>
              <div>
                <span className="text-zinc-500 block text-[10px] uppercase">Batch Quantity</span>
                <span className="font-bold text-zinc-900">{printProject.batchQuantity} pcs</span>
              </div>
              <div>
                <span className="text-zinc-500 block text-[10px] uppercase">Cost Per Unit</span>
                <span className="font-bold text-zinc-900">
                  Rs {printProject.productionCostPerUnit.toFixed(1)} / pc
                </span>
              </div>
              <div>
                <span className="text-zinc-500 block text-[10px] uppercase">Quoted Selling Rate</span>
                <span className="font-bold text-emerald-700">
                  Rs {printProject.quotedPricePerUnit.toFixed(0)} / pc
                </span>
              </div>
            </div>

            {/* Materials Detail */}
            <div>
              <h4 className="font-bold text-xs uppercase text-zinc-800 mb-1">
                Raw Material Consumption
              </h4>
              <table className="w-full text-xs border-collapse border border-zinc-200">
                <thead className="bg-zinc-100 text-[10px] uppercase text-zinc-600">
                  <tr>
                    <th className="border p-1.5 text-left">Material</th>
                    <th className="border p-1.5 text-left">Source</th>
                    <th className="border p-1.5 text-right">Per Unit</th>
                    <th className="border p-1.5 text-right">Batch Total</th>
                    <th className="border p-1.5 text-right">Cost (Rs)</th>
                  </tr>
                </thead>
                <tbody>
                  {printProject.materialEstimates.map(m => (
                    <tr key={m.id}>
                      <td className="border p-1.5">{m.materialName}</td>
                      <td className="border p-1.5">
                        {m.sourceType === 'customer_provided' ? 'Customer Khari (Free)' : 'Falcon Supplied'}
                      </td>
                      <td className="border p-1.5 text-right">
                        {m.consumptionPerUnit} {m.unit}
                      </td>
                      <td className="border p-1.5 text-right">
                        {m.totalQuantityOrWeight} {m.unit}
                      </td>
                      <td className="border p-1.5 text-right font-bold">
                        {m.sourceType === 'customer_provided' ? 'Rs 0' : fmt(m.totalCost)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Labour Detail */}
            <div>
              <h4 className="font-bold text-xs uppercase text-zinc-800 mb-1">
                Direct Labour Operations
              </h4>
              <table className="w-full text-xs border-collapse border border-zinc-200">
                <thead className="bg-zinc-100 text-[10px] uppercase text-zinc-600">
                  <tr>
                    <th className="border p-1.5 text-left">Operation</th>
                    <th className="border p-1.5 text-left">Worker / Station</th>
                    <th className="border p-1.5 text-right">Rate / Rod</th>
                    <th className="border p-1.5 text-right">Batch Total</th>
                  </tr>
                </thead>
                <tbody>
                  {printProject.labourOperations.map(l => (
                    <tr key={l.id}>
                      <td className="border p-1.5">{l.name}</td>
                      <td className="border p-1.5">{l.workerName || 'Staff'}</td>
                      <td className="border p-1.5 text-right">Rs {l.ratePerUnit.toFixed(2)}</td>
                      <td className="border p-1.5 text-right font-bold">{fmt(l.totalCost)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="pt-2 border-t text-[11px] text-zinc-500 flex justify-between items-center">
              <span>Date: {printProject.date}</span>
              <span className="font-bold text-zinc-900">
                Net Batch Margin: {fmt(printProject.expectedProfitTotal)} (+
                {printProject.profitMarginPercent}%)
              </span>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
