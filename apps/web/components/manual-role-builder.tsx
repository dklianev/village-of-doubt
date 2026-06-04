import {
  ManualRoleBuilderClient,
  type ManualRoleBuilderClientProps,
} from "@/components/manual-role-builder-client";
import "@/components/ManualRoleBuilder.module.css";

export type ManualRoleBuilderProps = ManualRoleBuilderClientProps;

export function ManualRoleBuilder(props: ManualRoleBuilderProps) {
  return (
    <section className="manual-role-builder mt-6 rounded-[2rem] p-5">
      <ManualRoleBuilderClient {...props} />
    </section>
  );
}
