import java

string get_caller(Method c) {
  if exists(MethodCall ma | ma.getMethod() = c)
  then result = any(MethodCall ma | ma.getMethod() = c).getEnclosingCallable().getLocation().getFile().getAbsolutePath() + ":" + any(MethodCall ma | ma.getMethod() = c).getEnclosingCallable().getLocation().getStartLine()
  else result = ""
}

from Method m
where m.fromSource()
select m.getName() as function_name, m.getLocation().getFile().getAbsolutePath() as file, m.getLocation().getStartLine() as start_line, m.getLocation().getFile().getAbsolutePath() + ":" + m.getLocation().getStartLine() as function_id, m.getBody().getLocation().getEndLine() as end_line, get_caller(m) as caller_id
