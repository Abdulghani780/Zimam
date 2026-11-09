from pathlib import Path

p = Path('frontend/src/pages/UsersPage.tsx')
text = p.read_text(encoding='utf-8')

old_button = """                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => handleToggleState(u)}"""

new_button = """                        <Button
                          size="sm"
                          variant="ghost"
                          loading={actionUser === u.username}
                          onClick={() => handleToggleState(u)}"""

if old_button in text:
    text = text.replace(old_button, new_button, 1)

old_finally = """      } else {
        toast(res.error || 'فشلت العملية', 'error');
      }
    } catch (err: any) {
      toast(err.message || 'خطأ في تعديل الحالة', 'error');
    }
  };"""

new_finally = """      } else {
        toast(res.error || 'فشلت العملية', 'error');
      }
    } catch (err: any) {
      toast(err.message || 'خطأ في تعديل الحالة', 'error');
    } finally {
      setActionUser(null);
    }
  };"""

if old_finally in text:
    text = text.replace(old_finally, new_finally, 1)

p.write_text(text, encoding='utf-8')
print("UsersPage.tsx actionUser updated successfully!")
