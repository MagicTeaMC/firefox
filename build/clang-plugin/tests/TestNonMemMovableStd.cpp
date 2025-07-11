#define MOZ_NEEDS_MEMMOVABLE_TYPE __attribute__((annotate("moz_needs_memmovable_type")))
#define MOZ_RUNINIT  __attribute__((annotate("moz_global_var")))

template<class T>
class MOZ_NEEDS_MEMMOVABLE_TYPE Mover { T mForceInst; }; // expected-error-re 10 {{Cannot instantiate 'Mover<{{.*}}>' with non-memmovable template argument '{{.*}}'}}

template<class T>
struct MOZ_NEEDS_MEMMOVABLE_TYPE PtrMover { T* mForceInst; };

namespace std {
// In theory defining things in std:: like this invokes undefined
// behavior, but in practice it's good enough for this test case.
template<class C> class basic_string { // expected-note 2 {{'std::basic_string<char>' is a non-memmove()able type because it is an stl-provided type not guaranteed to be memmove-able}} expected-note {{'std::string' (aka 'basic_string<char>') is a non-memmove()able type because it is an stl-provided type not guaranteed to be memmove-able}}
 public:
  basic_string();
  basic_string(const basic_string&);
  basic_string(basic_string&&);
  basic_string& operator=(const basic_string&);
  basic_string& operator=(basic_string&&);
  ~basic_string();
};
typedef basic_string<char> string;
template<class T, class U> class pair { T mT; U mU; }; // expected-note-re 4 {{'std::pair<bool, {{.*}}>' is a non-memmove()able type because it has a template argument non-memmove()able type '{{.*}}'}}

struct has_nontrivial_dtor {  // expected-note 2 {{'std::has_nontrivial_dtor' is a non-memmove()able type because it is an stl-provided type not guaranteed to be memmove-able}}
  has_nontrivial_dtor() = default;
  ~has_nontrivial_dtor();
};
struct has_nontrivial_copy {  // expected-note 2 {{'std::has_nontrivial_copy' is a non-memmove()able type because it is an stl-provided type not guaranteed to be memmove-able}}
  has_nontrivial_copy() = default;
  has_nontrivial_copy(const has_nontrivial_copy&);
  has_nontrivial_copy& operator=(const has_nontrivial_copy&);
};
struct has_nontrivial_move {  // expected-note 2 {{'std::has_nontrivial_move' is a non-memmove()able type because it is an stl-provided type not guaranteed to be memmove-able}}
  has_nontrivial_move() = default;
  has_nontrivial_move(const has_nontrivial_move&);
  has_nontrivial_move& operator=(const has_nontrivial_move&);
};
struct has_trivial_dtor {
  has_trivial_dtor() = default;
  ~has_trivial_dtor() = default;
};
struct has_trivial_copy {
  has_trivial_copy() = default;
  has_trivial_copy(const has_trivial_copy&) = default;
  has_trivial_copy& operator=(const has_trivial_copy&) = default;
};
struct has_trivial_move {
  has_trivial_move() = default;
  has_trivial_move(const has_trivial_move&) = default;
  has_trivial_move& operator=(const has_trivial_move&) = default;
};

template<class T>
struct default_delete {
  void operator()( T* ptr ) { delete ptr; }
};

template <typename T, typename D=default_delete<T>>
struct unique_ptr { // expected-note {{std::unique_ptr<std::basic_string<char>, custom_deleter<std::basic_string<char>>>' is a non-memmove()able type because it is an stl-provided type not guaranteed to be memmove-able}}
  T * ptr;
  D del;
  unique_ptr() = default;
  unique_ptr(T *p);
  unique_ptr(unique_ptr const&) = delete;
  unique_ptr(unique_ptr &&);
  ~unique_ptr();
};
}

class HasString { std::string m; }; // expected-note {{'HasString' is a non-memmove()able type because member 'm' is a non-memmove()able type 'std::string' (aka 'basic_string<char>')}}

template<class T>
struct custom_deleter : std::default_delete<T> {
  std::string m = {};
};

MOZ_RUNINIT  static Mover<std::string> bad; // expected-note-re {{instantiation of 'Mover<std::basic_string<char>{{ ?}}>' requested here}}
MOZ_RUNINIT  static Mover<HasString> bad_mem; // expected-note {{instantiation of 'Mover<HasString>' requested here}}
static Mover<std::pair<bool, int>> good;
MOZ_RUNINIT static Mover<std::pair<bool, std::string>> not_good; // expected-note-re {{instantiation of 'Mover<std::pair<bool, std::basic_string<char>{{ ?}}>{{ ?}}>' requested here}}

MOZ_RUNINIT  static Mover<std::has_nontrivial_dtor> nontrivial_dtor; // expected-note {{instantiation of 'Mover<std::has_nontrivial_dtor>' requested here}}
static Mover<std::has_nontrivial_copy> nontrivial_copy; // expected-note {{instantiation of 'Mover<std::has_nontrivial_copy>' requested here}}
static Mover<std::has_nontrivial_move> nontrivial_move; // expected-note {{instantiation of 'Mover<std::has_nontrivial_move>' requested here}}
static Mover<std::has_trivial_dtor> trivial_dtor;
static Mover<std::has_trivial_copy> trivial_copy;
static Mover<std::has_trivial_move> trivial_move;

MOZ_RUNINIT  static Mover<std::pair<bool, std::has_nontrivial_dtor>> pair_nontrivial_dtor; // expected-note {{instantiation of 'Mover<std::pair<bool, std::has_nontrivial_dtor>>' requested here}}
static Mover<std::pair<bool, std::has_nontrivial_copy>> pair_nontrivial_copy; // expected-note {{instantiation of 'Mover<std::pair<bool, std::has_nontrivial_copy>>' requested here}}
static Mover<std::pair<bool, std::has_nontrivial_move>> pair_nontrivial_move; // expected-note {{instantiation of 'Mover<std::pair<bool, std::has_nontrivial_move>>' requested here}}
static Mover<std::pair<bool, std::has_trivial_dtor>> pair_trivial_dtor;
static Mover<std::pair<bool, std::has_trivial_copy>> pair_trivial_copy;
static Mover<std::pair<bool, std::has_trivial_move>> pair_trivial_move;

MOZ_RUNINIT static Mover<std::unique_ptr<int>> a_good_unique_ptr;

// unique_ptr don't require memmove()able 1st template argument
MOZ_RUNINIT static Mover<std::unique_ptr<std::string>> another_good_unique_ptr;
MOZ_RUNINIT static Mover<std::unique_ptr<std::string, custom_deleter<std::string>>> bad_unique_ptr; // expected-note {{instantiation of 'Mover<std::unique_ptr<std::basic_string<char>, custom_deleter<std::basic_string<char>>>>' requested here}}

struct Fwd;
// Not enough information to complain
static PtrMover<std::unique_ptr<Fwd>> bad_fwd_unique_ptr;
