import BlogForm from "@/components/admin/BlogForm";
import RequirePermission from "@/components/admin/RequirePermission";

export default function NewBlogPage() {
   return (
     <RequirePermission permission="blogs.create">
       <BlogForm />
     </RequirePermission>
   );
}
